#!/usr/bin/env bash
set -euo pipefail

sudo mkdir -p \
  /etc/containers/systemd \
  /etc/caddy/conf.d \
  /srv/adventure-time-tcg/postgres \
  /srv/adventure-time-tcg/minio \
  /home/zax/adventure-time-tcg-secrets

sudo chown -R zax:zax /srv/adventure-time-tcg /home/zax/adventure-time-tcg-secrets

echo "Host directories are ready."
echo "Next: copy infra/caddy/app.leaetzak.love.Caddyfile to /etc/caddy/conf.d/ and install the Quadlet files from infra/containers/quadlet into /etc/containers/systemd/."
