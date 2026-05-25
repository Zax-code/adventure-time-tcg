# Adventure Time Phoenix API

This is the primary backend for `adventure-time-tcg`.

## Role

- serves the mobile app API
- owns the live PostgreSQL schema through Ecto migrations
- owns production data migration from the legacy PWA
- replaces the old Fastify API for normal development

## Local Defaults

- HTTP: `127.0.0.1:4200`
- PostgreSQL: `127.0.0.1:5434`
- MinIO: `127.0.0.1:9100`
- host: `app.leaetzak.love`

## Commands

```bash
mix deps.get
mix ecto.create
mix ecto.migrate
mix ecto.reset
mix run priv/repo/seeds.exs
mix phx.server
mix test
mix test test/adventure_time_api_web/controllers/health_controller_test.exs
mix format
mix format --check-formatted
mix precommit
```

Load env first when needed:

```bash
set -a
source .env
set +a
```

## PWA Import Commands

```bash
set -a
source .env
set +a
MIX_ENV=dev mix pwa_import audit
MIX_ENV=dev mix pwa_import apply
MIX_ENV=dev mix pwa_import verify
MIX_ENV=dev mix pwa_import reset
```

Default import source:

- `/home/zax/adventure-time-tcg/.env.postgres.production.local`

Default report directory:

- `/home/zax/adventure-time-tcg/.migration-reports`

The importer removes Phoenix placeholder/dev rows first and intentionally leaves all legacy PvP history behind.

## Production Service

The checked-in systemd unit template is:

- `infra/systemd-adventure-time-tcg-api.service`

The checked-in public Caddy proxy snippet is:

- `infra/caddy/app.leaetzak.love.Caddyfile`

## Verification

Before finishing backend work, run the narrowest relevant Phoenix checks and then:

```bash
mix precommit
```
