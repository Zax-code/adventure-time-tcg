#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
renderer="$repo_root/infra/scripts/render-container-envs.sh"
test_root="$(mktemp -d)"

cleanup() {
  rm -rf "$test_root"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

assert_line() {
  local expected="$1"
  local file="$2"

  grep -Fqx "$expected" "$file" || fail "missing '$expected' in $file"
}

file_mode() {
  if stat -f '%Lp' "$1" >/dev/null 2>&1; then
    stat -f '%Lp' "$1"
  else
    stat -c '%a' "$1"
  fi
}

source_env="$test_root/source.env"
api_target="$test_root/rendered/api.container.env"
minio_target="$test_root/rendered/minio.container.env"

printf '%s\n' \
  'PHX_HOST=app.example.test' \
  'FITBIT_REDIRECT_URI=https://app.leaetzak.love/api/fitbit/callback' \
  'MINIO_ENDPOINT=host.containers.internal' \
  'MINIO_PORT=9100' \
  'MINIO_ACCESS_KEY=access=user' \
  'MINIO_SECRET_KEY=secret=value=with-equals' \
  'MINIO_BUCKET=private-images' > "$source_env"

bash "$renderer" \
  --source "$source_env" \
  --api-target "$api_target" \
  --minio-target "$minio_target"

assert_line 'PHX_HOST=app.example.test' "$api_target"
assert_line 'FITBIT_REDIRECT_URI=https://app.leaetzak.love/api/fitbit/callback' "$api_target"
assert_line 'MINIO_ENDPOINT=127.0.0.1' "$api_target"
assert_line 'MINIO_ACCESS_KEY=access=user' "$api_target"
assert_line 'MINIO_SECRET_KEY=secret=value=with-equals' "$api_target"
assert_line 'MINIO_ROOT_USER=access=user' "$minio_target"
assert_line 'MINIO_ROOT_PASSWORD=secret=value=with-equals' "$minio_target"

[ "$(wc -l < "$minio_target" | tr -d ' ')" = 2 ] ||
  fail "MinIO env should contain exactly two entries"
[ "$(file_mode "$api_target")" = 600 ] || fail "API env mode should be 600"
[ "$(file_mode "$minio_target")" = 600 ] || fail "MinIO env mode should be 600"

printf '%s\n' 'keep-api' > "$api_target"
printf '%s\n' 'keep-minio' > "$minio_target"
printf '%s\n' \
  'MINIO_ENDPOINT=127.0.0.1' \
  'MINIO_PORT=9100' \
  'MINIO_BUCKET=private-images' \
  'MINIO_ACCESS_KEY=' \
  'MINIO_SECRET_KEY=secret' > "$source_env"

if bash "$renderer" \
  --source "$source_env" \
  --api-target "$api_target" \
  --minio-target "$minio_target" >/dev/null 2>&1; then
  fail "renderer accepted an empty MinIO access key"
fi

assert_line 'keep-api' "$api_target"
assert_line 'keep-minio' "$minio_target"

echo "PASS: container env rendering keeps API and MinIO credentials aligned"
