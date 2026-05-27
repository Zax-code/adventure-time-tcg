#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: deploy-phoenix.sh --ref <git-ref-or-sha> --image-ref <image-ref> [options]

Options:
  --repo-root <path>            Repo checkout on the production host
  --app-dir <path>              Phoenix app directory relative to repo root
  --service <name>              systemd service name for the API container
  --env-file <path>             Source env file for Phoenix secrets
  --container-env-file <path>   Rendered env file consumed by the API container
  --quadlet-dir <path>          Quadlet installation directory
  --health-url <url>            Ready-check URL; defaults to localhost using port 4200
  --registry-auth-file <path>   Optional Podman auth file for private registries
  --registry-username <value>   Optional registry username for an ephemeral login
  --skip-migrate                Skip release migrations
  --help                        Show this help
EOF
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_clean_worktree() {
  if [ -n "$(git status --porcelain)" ]; then
    echo "Refusing to deploy from a dirty production checkout." >&2
    git status --short >&2
    exit 1
  fi
}

wait_for_systemd() {
  local service="$1"

  if sudo systemctl is-active --quiet "$service"; then
    return 0
  fi

  echo "systemd reports $service is not active after restart." >&2
  sudo systemctl status "$service" --no-pager >&2 || true
  sudo journalctl -u "$service" -n 200 --no-pager >&2 || true
  exit 1
}

wait_for_healthcheck() {
  local url="$1"

  for attempt in $(seq 1 20); do
    if curl --fail --silent --show-error --max-time 5 "$url" >/dev/null; then
      echo "Healthcheck passed at $url."
      return 0
    fi

    echo "Healthcheck attempt $attempt/20 failed for $url; retrying..." >&2
    sleep 3
  done

  echo "Healthcheck failed after repeated retries: $url" >&2
  return 1
}

resolve_env_file() {
  local repo_root="$1"

  if [ -n "$ENV_FILE" ]; then
    printf '%s\n' "$ENV_FILE"
    return 0
  fi

  if [ -f "/home/zax/adventure-time-tcg-secrets/api.env" ]; then
    printf '%s\n' "/home/zax/adventure-time-tcg-secrets/api.env"
    return 0
  fi

  if [ -f "$repo_root/$APP_DIR/.env" ]; then
    printf '%s\n' "$repo_root/$APP_DIR/.env"
    return 0
  fi

  echo "Unable to find a Phoenix env file. Provide --env-file explicitly." >&2
  exit 1
}

render_container_env() {
  local source_env="$1"
  local target_env="$2"
  local temp_env

  temp_env="$(mktemp)"

  sed -E \
    -e 's#^(DATABASE_URL=.*@)(127\.0\.0\.1|localhost|host\.containers\.internal):5434/#\1postgres:5432/#' \
    -e 's#^MINIO_ENDPOINT=(127\.0\.0\.1|localhost|host\.containers\.internal)$#MINIO_ENDPOINT=minio#' \
    -e 's#^MINIO_PORT=9100$#MINIO_PORT=9000#' \
    "$source_env" > "$temp_env"

  sudo install -d -m 0755 "$(dirname "$target_env")"
  sudo install -m 0600 "$temp_env" "$target_env"
  rm -f "$temp_env"
}

install_quadlets() {
  local repo_root="$1"
  local quadlet_source_dir="$repo_root/infra/containers/quadlet"
  local rendered_api

  rendered_api="$(mktemp)"
  sed "s#^Image=.*#Image=$IMAGE_REF#" \
    "$quadlet_source_dir/adventure-time-tcg-api.container" > "$rendered_api"

  sudo install -d -m 0755 "$QUADLET_DIR"
  sudo install -m 0644 "$quadlet_source_dir/adventure-time-tcg.network" \
    "$QUADLET_DIR/adventure-time-tcg.network"
  sudo install -m 0644 "$quadlet_source_dir/adventure-time-tcg-postgres.container" \
    "$QUADLET_DIR/adventure-time-tcg-postgres.container"
  sudo install -m 0644 "$quadlet_source_dir/adventure-time-tcg-minio.container" \
    "$QUADLET_DIR/adventure-time-tcg-minio.container"
  sudo install -m 0644 "$rendered_api" \
    "$QUADLET_DIR/adventure-time-tcg-api.container"
  rm -f "$rendered_api"
}

pull_image() {
  local pull_args=(pull "$IMAGE_REF")

  if [ -n "$REGISTRY_USERNAME" ] && [ -n "$REGISTRY_PASSWORD" ]; then
    printf '%s' "$REGISTRY_PASSWORD" | sudo podman login \
      --username "$REGISTRY_USERNAME" \
      --password-stdin \
      ghcr.io
  fi

  if [ -n "$REGISTRY_AUTH_FILE" ]; then
    pull_args=(pull --authfile "$REGISTRY_AUTH_FILE" "$IMAGE_REF")
  fi

  sudo podman "${pull_args[@]}"
}

run_migrations() {
  sudo podman rm -f adventure-time-tcg-api-migrate >/dev/null 2>&1 || true

  sudo podman run --rm \
    --name adventure-time-tcg-api-migrate \
    --pull=never \
    --network adventure-time-tcg \
    --env-file "$CONTAINER_ENV_FILE" \
    "$IMAGE_REF" \
    bin/adventure_time_api eval "AdventureTimeApi.Release.migrate"
}

cut_over_legacy_service() {
  local legacy_unit="/etc/systemd/system/$SERVICE_NAME"

  if [ -f "$legacy_unit" ]; then
    echo "Removing legacy systemd unit at $legacy_unit."
    sudo systemctl stop "$SERVICE_NAME" || true
    sudo systemctl disable "$SERVICE_NAME" || true
    sudo rm -f "$legacy_unit"
  fi
}

REF=""
IMAGE_REF=""
REPO_ROOT="/home/zax/adventure-time-tcg"
APP_DIR="apps/phoenix"
SERVICE_NAME="adventure-time-tcg-api.service"
ENV_FILE=""
CONTAINER_ENV_FILE="/home/zax/adventure-time-tcg-secrets/api.container.env"
QUADLET_DIR="/etc/containers/systemd"
HEALTH_URL="http://127.0.0.1:4200/ready"
REGISTRY_AUTH_FILE=""
REGISTRY_USERNAME=""
SKIP_MIGRATE="false"
RESOLVED_REF=""
REGISTRY_PASSWORD="${REGISTRY_PASSWORD:-}"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --ref)
      REF="${2:-}"
      shift 2
      ;;
    --image-ref)
      IMAGE_REF="${2:-}"
      shift 2
      ;;
    --repo-root)
      REPO_ROOT="${2:-}"
      shift 2
      ;;
    --app-dir)
      APP_DIR="${2:-}"
      shift 2
      ;;
    --service)
      SERVICE_NAME="${2:-}"
      shift 2
      ;;
    --env-file)
      ENV_FILE="${2:-}"
      shift 2
      ;;
    --container-env-file)
      CONTAINER_ENV_FILE="${2:-}"
      shift 2
      ;;
    --quadlet-dir)
      QUADLET_DIR="${2:-}"
      shift 2
      ;;
    --health-url)
      HEALTH_URL="${2:-}"
      shift 2
      ;;
    --registry-auth-file)
      REGISTRY_AUTH_FILE="${2:-}"
      shift 2
      ;;
    --registry-username)
      REGISTRY_USERNAME="${2:-}"
      shift 2
      ;;
    --skip-migrate)
      SKIP_MIGRATE="true"
      shift
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [ -z "$REF" ]; then
  echo "Missing required --ref argument." >&2
  usage >&2
  exit 1
fi

if [ -z "$IMAGE_REF" ]; then
  echo "Missing required --image-ref argument." >&2
  usage >&2
  exit 1
fi

require_command git
require_command curl
require_command podman
require_command sudo

cd "$REPO_ROOT"
require_clean_worktree

echo "Fetching latest repository state..."
git fetch --tags --prune origin

if git rev-parse --verify --quiet "origin/${REF}^{commit}" >/dev/null; then
  RESOLVED_REF="origin/${REF}"
elif git rev-parse --verify --quiet "${REF}^{commit}" >/dev/null; then
  RESOLVED_REF="$REF"
else
  echo "Unable to resolve deploy ref: $REF" >&2
  exit 1
fi

TARGET_SHA="$(git rev-parse "${RESOLVED_REF}^{commit}")"
CURRENT_SHA="$(git rev-parse HEAD)"

echo "Deploying Phoenix from $CURRENT_SHA to $TARGET_SHA using $RESOLVED_REF."
git checkout -B main "$TARGET_SHA"

ENV_FILE="$(resolve_env_file "$REPO_ROOT")"

if [ -n "$REGISTRY_AUTH_FILE" ] && [ ! -f "$REGISTRY_AUTH_FILE" ]; then
  echo "Missing registry auth file: $REGISTRY_AUTH_FILE" >&2
  exit 1
fi

echo "Rendering container env file from $ENV_FILE..."
render_container_env "$ENV_FILE" "$CONTAINER_ENV_FILE"

echo "Installing Quadlet units..."
install_quadlets "$REPO_ROOT"

echo "Reloading systemd..."
sudo systemctl daemon-reload

echo "Ensuring backing services are running..."
sudo systemctl restart adventure-time-tcg-network.service || sudo systemctl start adventure-time-tcg-network.service
sudo systemctl restart adventure-time-tcg-postgres.service adventure-time-tcg-minio.service || \
  sudo systemctl start adventure-time-tcg-postgres.service adventure-time-tcg-minio.service
wait_for_systemd adventure-time-tcg-postgres.service
wait_for_systemd adventure-time-tcg-minio.service

echo "Pulling API image $IMAGE_REF..."
pull_image

if [ "$SKIP_MIGRATE" != "true" ]; then
  echo "Running database migrations..."
  run_migrations
else
  echo "Skipping database migrations by request."
fi

cut_over_legacy_service

echo "Reloading systemd after API cutover..."
sudo systemctl daemon-reload
sudo systemctl restart "$SERVICE_NAME" || sudo systemctl start "$SERVICE_NAME"
wait_for_systemd "$SERVICE_NAME"

if ! wait_for_healthcheck "$HEALTH_URL"; then
  sudo systemctl status "$SERVICE_NAME" --no-pager >&2 || true
  sudo journalctl -u "$SERVICE_NAME" -n 200 --no-pager >&2 || true
  exit 1
fi

echo "Phoenix container deploy finished successfully at commit $TARGET_SHA."
