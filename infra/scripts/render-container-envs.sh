#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: render-container-envs.sh --source <path> --api-target <path> --minio-target <path>

Renders the API and MinIO container env files from one source env. The MinIO
root credentials are always derived from MINIO_ACCESS_KEY and MINIO_SECRET_KEY
so the two services cannot drift during deployment.
EOF
}

SOURCE_ENV=""
API_TARGET=""
MINIO_TARGET=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --source)
      SOURCE_ENV="${2:-}"
      shift 2
      ;;
    --api-target)
      API_TARGET="${2:-}"
      shift 2
      ;;
    --minio-target)
      MINIO_TARGET="${2:-}"
      shift 2
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

if [ -z "$SOURCE_ENV" ] || [ -z "$API_TARGET" ] || [ -z "$MINIO_TARGET" ]; then
  echo "Missing required source or target path." >&2
  usage >&2
  exit 1
fi

if [ ! -f "$SOURCE_ENV" ]; then
  echo "Source env file does not exist: $SOURCE_ENV" >&2
  exit 1
fi

require_single_nonempty_value() {
  local key="$1"

  if ! awk -v key="$key" '
    index($0, key "=") == 1 {
      count += 1
      if (length(substr($0, length(key) + 2)) > 0) nonempty += 1
    }
    END { exit !(count == 1 && nonempty == 1) }
  ' "$SOURCE_ENV"; then
    echo "Source env must contain exactly one non-empty $key entry." >&2
    exit 1
  fi
}

for required_key in \
  MINIO_ENDPOINT \
  MINIO_PORT \
  MINIO_BUCKET \
  MINIO_ACCESS_KEY \
  MINIO_SECRET_KEY; do
  require_single_nonempty_value "$required_key"
done

api_dir="$(dirname "$API_TARGET")"
minio_dir="$(dirname "$MINIO_TARGET")"
install -d -m 0755 "$api_dir" "$minio_dir"

api_temp="$(mktemp "$api_dir/.api.container.env.XXXXXX")"
minio_temp="$(mktemp "$minio_dir/.minio.container.env.XXXXXX")"

cleanup() {
  rm -f "$api_temp" "$minio_temp"
}
trap cleanup EXIT

sed -E \
  -e 's#^MINIO_ENDPOINT=(127\.0\.0\.1|localhost|host\.containers\.internal)$#MINIO_ENDPOINT=127.0.0.1#' \
  "$SOURCE_ENV" > "$api_temp"

awk '
  /^MINIO_ACCESS_KEY=/ {
    sub(/^MINIO_ACCESS_KEY=/, "MINIO_ROOT_USER=")
    print
  }
  /^MINIO_SECRET_KEY=/ {
    sub(/^MINIO_SECRET_KEY=/, "MINIO_ROOT_PASSWORD=")
    print
  }
' "$SOURCE_ENV" > "$minio_temp"

chmod 0600 "$api_temp" "$minio_temp"
mv -f "$api_temp" "$API_TARGET"
mv -f "$minio_temp" "$MINIO_TARGET"

echo "Rendered API and MinIO container env files from one credential source."
