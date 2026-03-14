# Infra Runbook

## Host roles

- Caddy stays the public edge on this VPS.
- The new API runs on `127.0.0.1:4100`.
- New Postgres and MinIO instances are isolated from the existing PWA stack.

## Planned services

- `adventure-time-native-postgres`
- `adventure-time-native-minio`
- `adventure-time-native-api`

## Active host services

- `container-adventure-time-native-postgres.service`
- `container-adventure-time-native-minio.service`
- `adventure-time-native-api.service`

The API currently runs directly from the checked-out repository with Node 22 under systemd.
Postgres and MinIO are managed with Podman-generated systemd services.

## Caddy

Install the site snippet from `infra/caddy/app.leaetzak.love.Caddyfile` into `/etc/caddy/conf.d/` and reload Caddy after the API is reachable.

Note: the shared `common_security` block on the host Caddy config aborts obvious CLI scanner user agents like `curl`, so health checks should use a browser-like user agent when validating through the public hostname.
