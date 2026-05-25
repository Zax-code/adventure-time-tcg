#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
APP_DIR=$(cd -- "$SCRIPT_DIR/.." && pwd)
ENV_FILE="$APP_DIR/.env"
EXAMPLE_FILE="$APP_DIR/.env.example"

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$EXAMPLE_FILE" "$ENV_FILE"
fi

set_env() {
  local key="$1"
  local value="$2"

  if grep -qE "^${key}=" "$ENV_FILE"; then
    python - "$ENV_FILE" "$key" "$value" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
key = sys.argv[2]
value = sys.argv[3]
lines = path.read_text().splitlines()
out = []
replaced = False
for line in lines:
    if line.startswith(f"{key}="):
        out.append(f"{key}={value}")
        replaced = True
    else:
        out.append(line)
if not replaced:
    out.append(f"{key}={value}")
path.write_text("\n".join(out) + "\n")
PY
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

generate_secret() {
  openssl rand -hex 32
}

pushd "$APP_DIR" >/dev/null
SECRET_KEY_BASE=$(mix phx.gen.secret)
popd >/dev/null

set_env "PHX_PORT" "4200"
set_env "DATABASE_URL" "postgresql://postgres:postgres@127.0.0.1:5434/adventure_time_phoenix_dev"
set_env "PHX_HOST" "app.leaetzak.love"
set_env "SECRET_KEY_BASE" "$SECRET_KEY_BASE"
set_env "ACCESS_TOKEN_SECRET" "$(generate_secret)"
set_env "REFRESH_TOKEN_SECRET" "$(generate_secret)"
set_env "EMAIL_VERIFICATION_SECRET" "$(generate_secret)"
set_env "AUTH_GOOGLE_ID" ""
set_env "GOOGLE_IOS_CLIENT_ID" ""
set_env "GOOGLE_ANDROID_CLIENT_ID" ""
set_env "MINIO_ENDPOINT" "127.0.0.1"
set_env "MINIO_PORT" "9100"
set_env "MINIO_USE_SSL" "false"
set_env "MINIO_ACCESS_KEY" "minio"
set_env "MINIO_SECRET_KEY" "replace-me"
set_env "MINIO_BUCKET" "private-images"
set_env "AUTH_EMAIL_FROM" '"Adventure Time TCG <no-reply@leaetzak.love>"'
set_env "AUTH_EMAIL_SENDMAIL_PATH" "/usr/bin/sendmail"
set_env "AUTH_EMAIL_EXPOSE_DEV_CODE" "false"
set_env "BOOTSTRAP_SUPERADMIN_EMAIL" "boomslang.a@gmail.com"

echo "Rotated Phoenix secrets in $ENV_FILE"
