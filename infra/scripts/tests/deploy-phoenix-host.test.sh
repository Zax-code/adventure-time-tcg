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
grep -Fq 'adventure-time-tcg-minio.service' "$deployer"
grep -Fq 'minecraft-prodigium.service' "$deployer"

if grep -Eq 'systemctl (restart|stop) (adventure-time-tcg-(postgres|minio)|caddy|minecraft-prodigium)' "$deployer"; then
  echo 'The restricted deployer must not stop or restart an unrelated service.' >&2
  exit 1
fi

grep -Fq 'registry-login' "$wrapper"
grep -Fq 'deploy\ *' "$wrapper"
grep -Fq 'public-health' "$wrapper"
! grep -Eq '(eval|bash -c|sh -c|SSH_ORIGINAL_COMMAND.*exec)' "$wrapper"
