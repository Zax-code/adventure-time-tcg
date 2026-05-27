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
- PostgreSQL and MinIO publish only to the VPS loopback interface via the shared pod, so Phoenix should target them as `127.0.0.1:5432` and `127.0.0.1:9000` from inside the pod
- `apps/phoenix/.env.container.example` is the checked-in reference shape for container-side Phoenix env vars
