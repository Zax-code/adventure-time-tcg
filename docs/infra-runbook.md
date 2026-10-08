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
- Garage (S3 object storage): `127.0.0.1:3900`

## Phoenix Service

The production containers consume three rendered/host-managed secret files:

- `/home/zax/adventure-time-tcg-secrets/api.container.env`
- `/home/zax/adventure-time-tcg-secrets/garage.container.env`
- `/home/zax/adventure-time-tcg-secrets/msmtprc`

Both container env files carry the same object storage key pair:
`GARAGE_DEFAULT_ACCESS_KEY` and `GARAGE_DEFAULT_SECRET_KEY` in
`garage.container.env` must equal `OBJECT_STORAGE_ACCESS_KEY` and
`OBJECT_STORAGE_SECRET_KEY` in `api.container.env`. Garage key IDs are `GK`
followed by 24 hex characters and secrets are 64 hex characters. They are host-managed; the restricted
deployer (`infra/scripts/deploy-phoenix-host.sh`) never writes them, so never
rotate one file without the other.

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

## Fitbit Public Endpoints

Phoenix owns the public Fitbit integration on the main application host:

- OAuth callback: `https://app.leaetzak.love/api/fitbit/callback`
- subscriber/webhook endpoint: `https://app.leaetzak.love/api/fitbit/webhook`

The source environment rendered into the API container must set
`FITBIT_REDIRECT_URI` to the exact callback URL above. It must also provide the
Fitbit client credentials and set `FITBIT_VERIFICATION_CODE` to the subscriber
verification code shown in the Fitbit developer portal. The checked-in example
is `apps/phoenix/.env.example`; secret values remain in the host-managed source
environment and must not be committed.

The provider migration is an external operation: update the registered OAuth
redirect URL and the default subscriber endpoint in the Fitbit developer portal,
then run the portal's subscriber verification. Phoenix responds with `204` for
the matching verification code and `404` for the intentionally incorrect code.
After new OAuth links and webhook deliveries use `app.leaetzak.love`, the legacy
`game.leaetzak.love` API proxy exceptions can be removed. Phoenix temporarily
keeps `/fitbit/callback` and `/fitbit/webhook` aliases on the app host for provider
transition traffic; they do not require routing through the legacy host.

The checked-in Caddy site routes only `/api/fitbit/webhook` ahead of the shared
scanner-user-agent abort rule. Fitbit's verifier identifies itself as a Java
HTTP client, so removing that narrow route makes subscriber verification fail
at Caddy before Phoenix can return the required `204` or `404` response.

Install/update the checked-in Quadlet files and then reload systemd:

```bash
sudo install -d -m 0755 /etc/adventure-time-tcg
sudo install -m 0644 infra/containers/garage/garage.toml /etc/adventure-time-tcg/garage.toml
sudo install -d -m 0700 /srv/adventure-time-tcg/garage
sudo cp infra/containers/quadlet/* /etc/containers/systemd/
sudo systemctl daemon-reload
sudo systemctl start adventure-time-tcg-pod.service
sudo systemctl start adventure-time-tcg-postgres.service
sudo systemctl start adventure-time-tcg-garage.service
sudo systemctl start adventure-time-tcg-api.service
```

## MinIO to Garage Migration

Production moved from the unmaintained community MinIO to Garage with
`infra/scripts/migrate-minio-to-garage.sh`, run as root from a copy of the
repository's `infra/` tree on the VPS:

1. `prepare` starts Garage beside MinIO on host loopback `3900`, generates
   `garage.container.env` if absent, copies every object with a pinned rclone
   image, and proves each object exists in Garage with the same size and MD5.
   Production keeps serving from MinIO.
2. `cutover` copies again, rewrites the object storage block of
   `api.container.env` (legacy `MINIO_*` names for the image already deployed
   plus `OBJECT_STORAGE_*` for newer images), restarts only the API, copies
   any late uploads, moves the API dependency to Garage, installs the updated
   pod file and deployer, then stops MinIO and parks its Quadlet in the backup
   directory. A failed readiness check restores the MinIO environment.
3. `rollback` restores MinIO from the recorded backup directory after copying
   Garage-only uploads back.
4. `finalize`, after an image that reads `OBJECT_STORAGE_*` is deployed,
   removes the legacy `MINIO_*` variables.

The pod file no longer publishes `9100`/`9101`; that takes effect only at the
next pod restart, which also restarts PostgreSQL, so do it in a maintenance
window. The MinIO data under `/srv/adventure-time-tcg/minio` and its nightly
archives remain rollback material until a retention decision deletes them.
`leaetzak-datastore-backup` (infrastructure repository) must back up Garage on
`127.0.0.1:3900` with the `garage.container.env` key pair once MinIO is stopped.

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
- the Garage container env at `/home/zax/adventure-time-tcg-secrets/garage.container.env` holds `GARAGE_RPC_SECRET` plus the default key pair and bucket; it is host-managed, not rewritten by deploys
- Garage runs `--single-node --default-bucket`, so the layout, key, and bucket are created idempotently at start; inspect it with `sudo podman exec adventure-time-tcg-garage /garage status` or `... /garage bucket info private-images`
- the Garage config is installed from `infra/containers/garage/garage.toml` to `/etc/adventure-time-tcg/garage.toml`
- the API container also expects `/home/zax/adventure-time-tcg-secrets/msmtprc`, mounted to `/etc/msmtprc`, so verification emails can relay through host Postfix
- PostgreSQL publishes only to the VPS loopback interface and Garage binds only loopback on the host network; the host-networked Phoenix container targets them as `127.0.0.1:5434` and `http://127.0.0.1:3900`
- `/ready` verifies PostgreSQL for container lifecycle checks, while `/ready/media` verifies object storage bucket authentication; deploys require both without turning a later media-only outage into a full API restart loop
- `apps/phoenix/.env.example` is the checked-in reference shape for Phoenix and container-side env vars
