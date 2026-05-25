#!/usr/bin/env bash
set -euo pipefail

sudo mkdir -p \
  /etc/caddy/conf.d \
  /srv/adventure-time-tcg/postgres \
  /srv/adventure-time-tcg/minio \
  /home/zax/adventure-time-tcg-secrets

sudo chown -R zax:zax /srv/adventure-time-tcg /home/zax/adventure-time-tcg-secrets

echo "Host directories are ready."
echo "Next: copy infra/caddy/app.leaetzak.love.Caddyfile to /etc/caddy/conf.d/ and install quadlet units if desired."
