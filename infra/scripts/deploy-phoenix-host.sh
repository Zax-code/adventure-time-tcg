#!/usr/bin/env bash
set -Eeuo pipefail
umask 0077

readonly revision=${1:-}
readonly image=${2:-}
readonly skip_migrate=${3:-false}
readonly service=adventure-time-tcg-api.service
readonly postgres_service=adventure-time-tcg-postgres.service
readonly minio_service=adventure-time-tcg-minio.service
readonly postgres_container=adventure-time-tcg-postgres
readonly database=adventure_time_tcg
readonly quadlet=/etc/containers/systemd/adventure-time-tcg-api.container
readonly registry_auth=/etc/adventure-time-tcg-deploy/ghcr-auth.json
readonly container_env=/home/zax/adventure-time-tcg-secrets/api.container.env
readonly backup_root=/var/backups/adventure-time-tcg/ci-deploy
readonly state_root=/var/lib/adventure-time-tcg-deploy
readonly health_url=http://127.0.0.1:4200/ready
readonly media_health_url=http://127.0.0.1:4200/ready/media

[[ $EUID -eq 0 ]] || { echo 'Deployment must run as root.' >&2; exit 77; }
[[ $revision =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid commit revision.' >&2; exit 64; }
[[ $image =~ ^ghcr\.io/zax-code/adventure-time-tcg-api@sha256:[0-9a-f]{64}$ ]] || {
  echo 'Invalid immutable image reference.' >&2
  exit 64
}
[[ $skip_migrate == true || $skip_migrate == false ]] || {
  echo 'Invalid migration policy.' >&2
  exit 64
}

for path in "$quadlet" "$registry_auth" "$container_env"; do
  [[ -f $path ]] || { echo "Required deployment input is absent: $path" >&2; exit 78; }
done
for command_name in podman systemctl curl flock sha256sum awk install; do
  command -v "$command_name" >/dev/null || {
    echo "Required command is absent: $command_name" >&2
    exit 78
  }
done

exec 9>/run/lock/adventure-time-tcg-deploy.lock
flock -n 9 || { echo 'Another Adventure deployment is running.' >&2; exit 75; }

for required_service in "$service" "$postgres_service" "$minio_service" caddy.service minecraft-prodigium.service; do
  systemctl is-active --quiet "$required_service" || {
    echo "Required production service is not active: $required_service" >&2
    exit 78
  }
done
[[ -z $(systemctl --failed --no-legend --no-pager) ]] || {
  echo 'The host has failed units; refusing deployment.' >&2
  exit 78
}

current_image=$(sed -n 's/^Image=//p' "$quadlet")
[[ -n $current_image ]] || { echo 'The active API image is not recorded.' >&2; exit 78; }

if [[ $current_image == "$image" ]] && \
   curl --fail --silent --show-error --max-time 5 "$health_url" >/dev/null && \
   curl --fail --silent --show-error --max-time 5 "$media_health_url" >/dev/null; then
  echo "Adventure Time TCG revision $revision is already healthy."
  exit 0
fi

echo "Pulling the immutable API image before changing the running service."
podman pull --authfile "$registry_auth" "$image"
podman image exists "$image"

observed_revision=$(podman image inspect \
  --format '{{ index .Labels "org.opencontainers.image.revision" }}' "$image")
[[ $observed_revision == "$revision" ]] || {
  echo 'The image revision label does not match the requested commit.' >&2
  exit 65
}

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_directory="$backup_root/${timestamp}-${revision:0:12}"
install -d -o root -g root -m 0700 "$backup_root" "$backup_directory" "$state_root"

backup_file="$backup_directory/postgresql.dump"
podman exec "$postgres_container" \
  pg_dump -U postgres -d "$database" --format=custom >"$backup_file.new"
podman exec -i "$postgres_container" pg_restore --list <"$backup_file.new" >/dev/null
chmod 0600 "$backup_file.new"
mv "$backup_file.new" "$backup_file"
sha256sum "$backup_file" >"$backup_directory/SHA256SUMS"
cp -a "$quadlet" "$backup_directory/adventure-time-tcg-api.container"

for watched_service in "$service" "$postgres_service" "$minio_service" caddy.service minecraft-prodigium.service; do
  printf '%s %s\n' "$watched_service" \
    "$(systemctl show "$watched_service" --property=NRestarts --value)"
done >"$backup_directory/restart-counters.before"

candidate=$(mktemp "$backup_directory/api.container.XXXXXX")
awk -v image="$image" '
  /^Image=/ { print "Image=" image; next }
  { print }
' "$quadlet" >"$candidate"
chmod 0644 "$candidate"

activation_started=false
restore_previous_api() {
  local status=$?
  trap - ERR
  if [[ $activation_started == true ]]; then
    echo 'Adventure deployment failed; restoring the previous API Quadlet.' >&2
    install -o root -g root -m 0644 \
      "$backup_directory/adventure-time-tcg-api.container" "$quadlet"
    systemctl daemon-reload
    systemctl reset-failed "$service" || true
    systemctl start "$service" || true
  fi
  exit "$status"
}
trap restore_previous_api ERR

echo 'Stopping only the Adventure API for the migration and image switch.'
systemctl stop "$service"
activation_started=true

if [[ $skip_migrate == false ]]; then
  podman run --rm \
    --name adventure-time-tcg-api-migrate \
    --pull=never \
    --network host \
    --env-file "$container_env" \
    "$image" \
    bin/adventure_time_api eval 'AdventureTimeApi.Release.migrate'
fi

install -o root -g root -m 0644 "$candidate" "$quadlet"
systemctl daemon-reload
systemctl reset-failed "$service" || true
systemctl start "$service"

for _ in $(seq 1 60); do
  if curl --fail --silent --show-error --max-time 5 "$health_url" >/dev/null && \
     curl --fail --silent --show-error --max-time 5 "$media_health_url" >/dev/null; then
    break
  fi
  sleep 2
done
curl --fail --silent --show-error --max-time 5 "$health_url" >/dev/null
curl --fail --silent --show-error --max-time 5 "$media_health_url" >/dev/null
systemctl is-active --quiet "$service" "$postgres_service" "$minio_service" caddy.service minecraft-prodigium.service

for watched_service in "$postgres_service" "$minio_service" caddy.service minecraft-prodigium.service; do
  before=$(awk -v unit="$watched_service" '$1 == unit { print $2 }' \
    "$backup_directory/restart-counters.before")
  after=$(systemctl show "$watched_service" --property=NRestarts --value)
  [[ $before == "$after" ]] || {
    echo "Unrelated service restarted during deployment: $watched_service" >&2
    exit 70
  }
done

printf '%s\n' "$revision" >"$state_root/current-revision.new"
mv "$state_root/current-revision.new" "$state_root/current-revision"
printf '%s\n' "$image" >"$state_root/current-image.new"
mv "$state_root/current-image.new" "$state_root/current-image"
printf '%s\n' "$backup_directory" >"$state_root/last-recovery-point.new"
mv "$state_root/last-recovery-point.new" "$state_root/last-recovery-point"
chmod 0600 "$state_root"/*

activation_started=false
trap - ERR
echo "Deployed Adventure Time TCG revision $revision successfully."
