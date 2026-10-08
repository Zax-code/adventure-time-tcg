#!/usr/bin/env bash
# One-time production migration of the Adventure object store from MinIO to
# Garage. Run as root on the VPS from a copy of this repository's infra/ tree:
#
#   migrate-minio-to-garage.sh prepare   start Garage beside MinIO and copy objects
#   migrate-minio-to-garage.sh cutover   point the API at Garage, stop MinIO
#   migrate-minio-to-garage.sh rollback  return the API to MinIO
#   migrate-minio-to-garage.sh finalize  drop the legacy MINIO_* API variables
#
# The pod, PostgreSQL, Caddy, and Prodigium are never restarted. MinIO data in
# /srv/adventure-time-tcg/minio is left untouched as the rollback source.
set -Eeuo pipefail
umask 0077

readonly phase=${1:-}
readonly infra_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

readonly secrets=/home/zax/adventure-time-tcg-secrets
readonly api_env=$secrets/api.container.env
readonly minio_env=$secrets/minio.container.env
readonly garage_env=$secrets/garage.container.env
readonly garage_conf=/etc/adventure-time-tcg/garage.toml
readonly garage_data=/srv/adventure-time-tcg/garage
readonly quadlet_dir=/etc/containers/systemd
readonly api_quadlet=$quadlet_dir/adventure-time-tcg-api.container
readonly minio_quadlet=$quadlet_dir/adventure-time-tcg-minio.container
readonly garage_quadlet=$quadlet_dir/adventure-time-tcg-garage.container
readonly pod_quadlet=$quadlet_dir/adventure-time-tcg.pod
readonly deployer=/usr/local/sbin/deploy-adventure-time-tcg
readonly drift_check=/usr/local/sbin/leaetzak-drift-check
readonly backup_root=/var/backups/adventure-time-tcg/garage-migration
readonly api_service=adventure-time-tcg-api.service
readonly postgres_service=adventure-time-tcg-postgres.service
readonly minio_service=adventure-time-tcg-minio.service
readonly garage_service=adventure-time-tcg-garage.service
readonly minio_url=http://127.0.0.1:9100
readonly garage_url=http://127.0.0.1:3900
readonly rclone_image=docker.io/rclone/rclone:1.75.1@sha256:45401ad7410db1d67ffdb58e19059ad20b0d8e0285a60e38bbec55cc1019c7a5

log() { printf '%s %s\n' "$(date -u +%H:%M:%SZ)" "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }

# Reads KEY=value from an env file without echoing it; strips one quote layer.
env_value() {
  local value
  value=$(sed -n "s/^$2=//p" "$1" | tail -n 1)
  value=${value%\"}; value=${value#\"}
  [[ -n $value ]] || die "$2 is missing from $1"
  printf '%s' "$value"
}

random_hex() { od -An -N "$1" -tx1 /dev/urandom | tr -d ' \n'; }

require_active() {
  local unit
  for unit in "$@"; do
    systemctl is-active --quiet "$unit" || die "$unit is not active"
  done
}

restarts() { systemctl show "$1" --property=NRestarts --value; }

wait_ready() {
  local _
  for _ in $(seq 1 60); do
    if curl -fsS --max-time 5 http://127.0.0.1:4200/ready >/dev/null 2>&1 &&
       curl -fsS --max-time 5 http://127.0.0.1:4200/ready/media >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

wait_garage() {
  local _
  for _ in $(seq 1 30); do
    # Any HTTP status proves the S3 listener is answering.
    [[ $(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$garage_url/" || true) != 000 ]] && return 0
    sleep 1
  done
  return 1
}

# Runs rclone with both stores configured through a private env file that is
# removed afterwards; credentials never reach a command line.
rclone_run() {
  local work status=0
  work=$(mktemp -d)
  {
    printf 'RCLONE_CONFIG_MINIO_TYPE=s3\nRCLONE_CONFIG_MINIO_PROVIDER=Minio\n'
    printf 'RCLONE_CONFIG_MINIO_ENDPOINT=%s\nRCLONE_CONFIG_MINIO_REGION=us-east-1\n' "$minio_url"
    printf 'RCLONE_CONFIG_MINIO_ACCESS_KEY_ID=%s\n' "$(env_value "$minio_env" MINIO_ROOT_USER)"
    printf 'RCLONE_CONFIG_MINIO_SECRET_ACCESS_KEY=%s\n' "$(env_value "$minio_env" MINIO_ROOT_PASSWORD)"
    printf 'RCLONE_CONFIG_GARAGE_TYPE=s3\nRCLONE_CONFIG_GARAGE_PROVIDER=Other\n'
    printf 'RCLONE_CONFIG_GARAGE_ENDPOINT=%s\nRCLONE_CONFIG_GARAGE_REGION=us-east-1\n' "$garage_url"
    printf 'RCLONE_CONFIG_GARAGE_FORCE_PATH_STYLE=true\nRCLONE_CONFIG_GARAGE_NO_CHECK_BUCKET=true\n'
    printf 'RCLONE_CONFIG_GARAGE_ACCESS_KEY_ID=%s\n' "$(env_value "$garage_env" GARAGE_DEFAULT_ACCESS_KEY)"
    printf 'RCLONE_CONFIG_GARAGE_SECRET_ACCESS_KEY=%s\n' "$(env_value "$garage_env" GARAGE_DEFAULT_SECRET_KEY)"
  } >"$work/rclone.env"
  podman run --rm --pull=never --network host --env-file "$work/rclone.env" \
    "$rclone_image" "$@" || status=$?
  rm -rf -- "$work"
  return "$status"
}

# Copies every object from $1 to $2 (no deletions), then proves each source
# object exists at the destination with the same size and MD5.
sync_objects() {
  local bucket
  bucket=$(env_value "$garage_env" GARAGE_DEFAULT_BUCKET)
  log "copying $1:$bucket -> $2:$bucket"
  rclone_run copy "$1:$bucket" "$2:$bucket" --checksum --stats-one-line --stats 0 -v 2>&1 |
    grep -E 'Transferred|ERROR' || true
  rclone_run check "$1:$bucket" "$2:$bucket" --one-way 2>&1 | tail -n 3
  log "objects: $1=$(rclone_run size "$1:$bucket" --json) $2=$(rclone_run size "$2:$bucket" --json)"
}

drift_clean() {
  "$drift_check" check >/dev/null || die 'host has unreviewed drift; review it before migrating'
}

new_backup_dir() {
  local dir
  dir="$backup_root/$(date -u +%Y%m%dT%H%M%SZ)-$phase"
  install -d -o root -g root -m 0700 "$backup_root" "$dir"
  printf '%s' "$dir"
}

replace_env_block() {
  # Rewrites $1 without any MINIO_*/OBJECT_STORAGE_* line, then appends stdin.
  local target=$1 candidate
  candidate=$(mktemp "$target.XXXXXX")
  grep -Ev '^(MINIO|OBJECT_STORAGE)_[A-Z_]+=' "$target" >"$candidate" || true
  cat >>"$candidate"
  chmod 0600 "$candidate"
  mv "$candidate" "$target"
}

prepare() {
  require_active "$api_service" "$postgres_service" "$minio_service"
  drift_clean
  podman image exists "$rclone_image" || podman pull "$rclone_image" >/dev/null
  local garage_image
  garage_image=$(sed -n 's/^Image=//p' "$infra_root/containers/quadlet/adventure-time-tcg-garage.container")
  podman image exists "$garage_image" || podman pull "$garage_image" >/dev/null

  if [[ ! -f $garage_env ]]; then
    log "generating $garage_env"
    {
      printf 'GARAGE_RPC_SECRET=%s\n' "$(random_hex 32)"
      printf 'GARAGE_DEFAULT_ACCESS_KEY=GK%s\n' "$(random_hex 12)"
      printf 'GARAGE_DEFAULT_SECRET_KEY=%s\n' "$(random_hex 32)"
      printf 'GARAGE_DEFAULT_BUCKET=%s\n' "$(env_value "$api_env" MINIO_BUCKET)"
    } >"$garage_env.new"
    chown root:root "$garage_env.new"
    chmod 0600 "$garage_env.new"
    mv "$garage_env.new" "$garage_env"
  fi

  install -d -o root -g root -m 0755 "$(dirname "$garage_conf")"
  install -o root -g root -m 0644 "$infra_root/containers/garage/garage.toml" "$garage_conf"
  install -d -o root -g root -m 0700 "$garage_data"
  install -o root -g root -m 0644 \
    "$infra_root/containers/quadlet/adventure-time-tcg-garage.container" "$garage_quadlet"
  systemctl daemon-reload
  systemctl start "$garage_service"
  wait_garage || die 'Garage S3 API did not come up'
  require_active "$garage_service"

  sync_objects minio garage
  "$drift_check" baseline >/dev/null
  log 'prepare complete; MinIO still serves production'
}

cutover() {
  require_active "$api_service" "$postgres_service" "$minio_service" "$garage_service"
  drift_clean
  local dir postgres_restarts
  dir=$(new_backup_dir)
  postgres_restarts=$(restarts "$postgres_service")
  cp -a "$api_env" "$dir/api.container.env"
  cp -a "$api_quadlet" "$minio_quadlet" "$pod_quadlet" "$deployer" "$dir/"
  printf '%s\n' "$dir" >"$backup_root/last-cutover"

  sync_objects minio garage

  local key secret bucket
  key=$(env_value "$garage_env" GARAGE_DEFAULT_ACCESS_KEY)
  secret=$(env_value "$garage_env" GARAGE_DEFAULT_SECRET_KEY)
  bucket=$(env_value "$garage_env" GARAGE_DEFAULT_BUCKET)
  # MINIO_* keeps the currently deployed image working; OBJECT_STORAGE_* is
  # what the next image reads. `finalize` drops the legacy names.
  replace_env_block "$api_env" <<EOF
MINIO_ENDPOINT=127.0.0.1
MINIO_PORT=3900
MINIO_USE_SSL=false
MINIO_BUCKET=$bucket
MINIO_ACCESS_KEY=$key
MINIO_SECRET_KEY=$secret
OBJECT_STORAGE_URL=$garage_url
OBJECT_STORAGE_BUCKET=$bucket
OBJECT_STORAGE_ACCESS_KEY=$key
OBJECT_STORAGE_SECRET_KEY=$secret
EOF
  unset key secret

  log "restarting only $api_service against Garage"
  systemctl restart "$api_service"
  if ! wait_ready; then
    log 'API not ready on Garage; restoring the MinIO environment' >&2
    install -o root -g root -m 0600 "$dir/api.container.env" "$api_env"
    systemctl restart "$api_service"
    wait_ready || die 'API also failed after restoring MinIO; investigate now'
    die 'cutover aborted; API is back on MinIO'
  fi

  # Pick up anything uploaded to MinIO between the first copy and the restart.
  sync_objects minio garage

  # Swap the API dependency before stopping MinIO: Requires= would otherwise
  # stop the API along with MinIO.
  sed -i 's/adventure-time-tcg-minio\.service/adventure-time-tcg-garage.service/g' "$api_quadlet"
  install -o root -g root -m 0644 "$infra_root/containers/quadlet/adventure-time-tcg.pod" "$pod_quadlet"
  install -o root -g root -m 0755 "$infra_root/scripts/deploy-phoenix-host.sh" "$deployer"
  systemctl daemon-reload
  systemctl stop "$minio_service"
  mv "$minio_quadlet" "$dir/adventure-time-tcg-minio.container.removed"
  systemctl daemon-reload

  require_active "$api_service" "$postgres_service" "$garage_service"
  ! systemctl is-active --quiet "$minio_service" || die 'MinIO is still active'
  [[ $(restarts "$postgres_service") == "$postgres_restarts" ]] || die 'PostgreSQL restarted'
  wait_ready || die 'API not ready after stopping MinIO'
  "$drift_check" baseline >/dev/null
  log "cutover complete; rollback material in $dir"
}

rollback() {
  local dir
  dir=$(cat "$backup_root/last-cutover" 2>/dev/null) || die 'no recorded cutover'
  [[ -f $dir/api.container.env ]] || die "incomplete rollback material in $dir"
  log "rolling back from $dir"
  install -o root -g root -m 0644 "$dir/adventure-time-tcg-minio.container" "$minio_quadlet"
  systemctl daemon-reload
  systemctl start "$minio_service"
  sleep 3
  # Keep uploads made while Garage was serving.
  sync_objects garage minio
  install -o root -g root -m 0644 "$dir/adventure-time-tcg-api.container" "$api_quadlet.rollback"
  # Keep the image the deployer may have installed since the cutover.
  sed -i "s|^Image=.*|$(grep '^Image=' "$api_quadlet")|" "$api_quadlet.rollback"
  mv "$api_quadlet.rollback" "$api_quadlet"
  install -o root -g root -m 0644 "$dir/adventure-time-tcg.pod" "$pod_quadlet"
  install -o root -g root -m 0755 "$dir/deploy-adventure-time-tcg" "$deployer"
  install -o root -g root -m 0600 "$dir/api.container.env" "$api_env"
  systemctl daemon-reload
  systemctl restart "$api_service"
  wait_ready || die 'API not ready on MinIO after rollback'
  "$drift_check" baseline >/dev/null
  log 'rollback complete; Garage is left running but unused'
}

finalize() {
  require_active "$api_service" "$garage_service"
  ! systemctl is-active --quiet "$minio_service" || die 'MinIO is still active; run cutover first'
  local image_revision dir
  image_revision=$(podman image inspect --format '{{ index .Labels "org.opencontainers.image.revision" }}' \
    "$(sed -n 's/^Image=//p' "$api_quadlet")")
  log "running API image revision $image_revision"
  podman exec adventure-time-tcg-api sh -c 'grep -q OBJECT_STORAGE_URL /app/releases/*/runtime.exs' ||
    die 'the running API image does not read OBJECT_STORAGE_*; deploy it first'
  dir=$(new_backup_dir)
  cp -a "$api_env" "$dir/api.container.env"
  grep -Ev '^MINIO_[A-Z_]+=' "$api_env" | replace_env_block "$api_env.next" 2>/dev/null || true
  local candidate
  candidate=$(mktemp "$api_env.XXXXXX")
  grep -Ev '^MINIO_[A-Z_]+=' "$api_env" >"$candidate"
  chmod 0600 "$candidate"
  mv "$candidate" "$api_env"
  rm -f -- "$api_env.next"
  log "legacy MINIO_* variables removed (backup in $dir); they take effect at the next API restart"
}

[[ $EUID -eq 0 ]] || die 'run as root'
case $phase in
  prepare) prepare ;;
  cutover) cutover ;;
  rollback) rollback ;;
  finalize) finalize ;;
  *) die 'usage: migrate-minio-to-garage.sh prepare|cutover|rollback|finalize' ;;
esac
