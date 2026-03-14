# Infra Runbook

## Host roles

- Caddy stays the public edge on this VPS.
- The new API runs on `127.0.0.1:4100`.
- New Postgres and MinIO instances are isolated from the existing PWA stack.

## Planned services

- `adventure-time-native-postgres`
- `adventure-time-native-minio`
- `adventure-time-native-api`

## Caddy

Install the site snippet from `infra/caddy/app.leaetzak.love.Caddyfile` into `/etc/caddy/conf.d/` and reload Caddy after the API is reachable.
