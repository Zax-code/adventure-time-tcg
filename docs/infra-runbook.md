# Infra Runbook

## Public Routing

- Caddy is the public edge on this VPS.
- Phoenix should listen on `127.0.0.1:4200`.
- `app.leaetzak.love` should reverse proxy to Phoenix.
- `phoenix.leaetzak.love` can remain as an auxiliary smoke/debug hostname.

## Checked-In Host Files

- Caddy snippet: `infra/caddy/app.leaetzak.love.Caddyfile`
- Quadlet templates: `infra/containers/quadlet/`

## Current Data Services

- PostgreSQL: `127.0.0.1:5434`
- MinIO: `127.0.0.1:9100`

## Phoenix Service

The production containers consume three rendered/host-managed secret files:

- `/home/zax/adventure-time-tcg-secrets/api.container.env`
- `/home/zax/adventure-time-tcg-secrets/minio.container.env`
- `/home/zax/adventure-time-tcg-secrets/msmtprc`

`infra/scripts/render-container-envs.sh` renders both container env files from the
same Phoenix source env. It maps `MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY` to
`MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`; never rotate or render the two files
independently.

The `msmtprc` file is required because the production image ships `sendmail` via `msmtp`. On this VPS it should relay through the host Postfix listener at `127.0.0.1:25`, for example:

```ini
defaults
auth off
tls off
tls_starttls off
account default
host 127.0.0.1
port 25
from no-reply@leaetzak.love
auto_from off
add_missing_from_header on
set_from_header on
```

Install/update the checked-in Quadlet files and then reload systemd:

```bash
sudo cp infra/containers/quadlet/* /etc/containers/systemd/
sudo systemctl daemon-reload
sudo systemctl start adventure-time-tcg-pod.service
sudo systemctl start adventure-time-tcg-postgres.service
sudo systemctl start adventure-time-tcg-minio.service
sudo systemctl start adventure-time-tcg-api.service
```

## Caddy Cutover

Install/update the checked-in Caddy snippet and reload Caddy:

```bash
sudo cp infra/caddy/app.leaetzak.love.Caddyfile /etc/caddy/conf.d/app.leaetzak.love.Caddyfile
sudo systemctl reload caddy
```

## Archived Legacy Backend

- `apps/api` is kept in-repo as an archived reference only.
- It is no longer part of active workspace tooling or production service management.

## Notes

- the Caddy access log path is `/var/log/caddy/app.leaetzak.love.access.log`
- Caddy runs as `caddy:caddy`, so keep that file writable by the Caddy service user
- if Caddy status still shows a stale permission warning after a successful reload, validate with a direct local HTTPS request before treating it as a live routing problem
- the API container expects a rendered env file at `/home/zax/adventure-time-tcg-secrets/api.container.env`
- the MinIO container env at `/home/zax/adventure-time-tcg-secrets/minio.container.env` is rendered from the same source credentials during every deploy
- the API container also expects `/home/zax/adventure-time-tcg-secrets/msmtprc`, mounted to `/etc/msmtprc`, so verification emails can relay through host Postfix
- PostgreSQL and MinIO publish only to the VPS loopback interface; the host-networked Phoenix container should target them as `127.0.0.1:5434` and `127.0.0.1:9100`
- `/ready` verifies PostgreSQL for container lifecycle checks, while `/ready/media` verifies MinIO bucket authentication; deploys require both without turning a later media-only outage into a full API restart loop
- `apps/phoenix/.env.container.example` is the checked-in reference shape for container-side Phoenix env vars
