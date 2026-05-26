#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: deploy-phoenix.sh --ref <git-ref-or-sha> [options]

Options:
  --repo-root <path>   Repo checkout on the production host
  --app-dir <path>     Phoenix app directory relative to repo root
  --service <name>     systemd service name
  --health-url <url>   Ready-check URL; defaults to localhost using PHX_PORT
  --skip-migrate       Skip mix ecto.migrate
  --help               Show this help
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

REF=""
REPO_ROOT="/home/zax/adventure-time-tcg"
APP_DIR="apps/phoenix"
SERVICE_NAME="adventure-time-tcg-api.service"
HEALTH_URL=""
SKIP_MIGRATE="false"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --ref)
      REF="${2:-}"
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
    --health-url)
      HEALTH_URL="${2:-}"
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

require_command git
require_command mix
require_command curl
require_command sudo

cd "$REPO_ROOT"
require_clean_worktree

echo "Fetching latest repository state..."
git fetch --tags --prune origin

if ! git rev-parse --verify --quiet "${REF}^{commit}" >/dev/null; then
  echo "Unable to resolve deploy ref: $REF" >&2
  exit 1
fi

TARGET_SHA="$(git rev-parse "${REF}^{commit}")"
CURRENT_SHA="$(git rev-parse HEAD)"

echo "Deploying Phoenix from $CURRENT_SHA to $TARGET_SHA."
git checkout -B main "$TARGET_SHA"

cd "$REPO_ROOT/$APP_DIR"

if [ ! -f ".env" ]; then
  echo "Missing Phoenix environment file at $REPO_ROOT/$APP_DIR/.env" >&2
  exit 1
fi

set -a
source ./.env
set +a

export MIX_ENV=prod
export PHX_SERVER=true
export PORT="${PHX_PORT:-4200}"

if [ -z "$HEALTH_URL" ]; then
  HEALTH_URL="http://127.0.0.1:${PORT}/ready"
fi

echo "Installing production dependencies..."
mix deps.get --only prod

echo "Compiling Phoenix application..."
mix compile

if [ "$SKIP_MIGRATE" != "true" ]; then
  echo "Running database migrations..."
  mix ecto.migrate
else
  echo "Skipping database migrations by request."
fi

echo "Restarting $SERVICE_NAME..."
sudo systemctl restart "$SERVICE_NAME"
wait_for_systemd "$SERVICE_NAME"

if ! wait_for_healthcheck "$HEALTH_URL"; then
  sudo systemctl status "$SERVICE_NAME" --no-pager >&2 || true
  sudo journalctl -u "$SERVICE_NAME" -n 200 --no-pager >&2 || true
  exit 1
fi

echo "Phoenix deploy finished successfully at commit $TARGET_SHA."
