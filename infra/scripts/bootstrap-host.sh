#!/usr/bin/env bash
set -euo pipefail

sudo mkdir -p \
  /etc/caddy/conf.d \
  /srv/adventure-time-native/postgres \
  /srv/adventure-time-native/minio \
  /home/zax/adventure-time-native-secrets

sudo chown -R zax:zax /srv/adventure-time-native /home/zax/adventure-time-native-secrets

echo "Host directories are ready."
echo "Next: copy infra/caddy/app.leaetzak.love.Caddyfile to /etc/caddy/conf.d/ and install quadlet units if desired."
