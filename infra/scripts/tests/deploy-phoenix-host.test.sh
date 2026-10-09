#!/usr/bin/env bash
set -euo pipefail

readonly script_directory=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
readonly deployer="$script_directory/../deploy-phoenix-host.sh"
readonly wrapper="$script_directory/../adventure-time-tcg-deploy-ssh"

bash -n "$deployer" "$wrapper"
grep -Fq 'pg_dump -U postgres -d "$database" --format=custom' "$deployer"
grep -Fq 'org.opencontainers.image.revision' "$deployer"
grep -Fq 'systemctl stop "$service"' "$deployer"
grep -Fq 'systemctl start "$service"' "$deployer"
grep -Fq 'adventure-time-tcg-postgres.service' "$deployer"
grep -Fq 'adventure-time-tcg-garage.service' "$deployer"
grep -Fq 'minecraft-prodigium.service' "$deployer"
grep -Fq '"$drift_check" check' "$deployer"
grep -Fq '"$drift_check" approve "$quadlet"' "$deployer"

line_of() { grep -n -m 1 -F "$1" "$deployer" | cut -d: -f1; }
[[ $(line_of '"$drift_check" check') -lt $(line_of 'podman pull') ]] || {
  echo 'The drift check must run before the deployment changes anything.' >&2
  exit 1
}
[[ $(line_of "grep -c '^Image='") -lt $(line_of 'current-revision.new') ]] || {
  echo 'The installed image must be verified before the deployment is recorded.' >&2
  exit 1
}
[[ $(line_of '"$drift_check" approve') -gt $(line_of 'current-revision.new') ]] || {
  echo 'The drift approval must follow the verified, recorded deployment.' >&2
  exit 1
}
if grep -Eq 'leaetzak-drift-check"? baseline|drift_check"? baseline' "$deployer"; then
  echo 'The deployer must approve only its Quadlet, never re-record the baseline.' >&2
  exit 1
fi

if grep -Eq 'systemctl (restart|stop) ("?\$(postgres|object_storage)_service|adventure-time-tcg-(postgres|garage|minio)|caddy|minecraft-prodigium)' "$deployer"; then
  echo 'The restricted deployer must not stop or restart an unrelated service.' >&2
  exit 1
fi

grep -Fq 'registry-login' "$wrapper"
grep -Fq 'deploy\ *' "$wrapper"
grep -Fq 'public-health' "$wrapper"
! grep -Eq '(eval|bash -c|sh -c|SSH_ORIGINAL_COMMAND.*exec)' "$wrapper"
