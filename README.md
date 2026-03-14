# Adventure Time Native

Native-first self-hosted rebuild of Adventure Time TCG.

## Apps

- `apps/mobile` - Expo / React Native client
- `apps/api` - Fastify API and realtime backend

## Packages

- `packages/db` - Drizzle schema and database helpers
- `packages/shared` - schemas, DTOs, constants
- `packages/game-engine` - extracted domain logic
- `packages/api-client` - typed API client

## Infra

- `infra/caddy` - Caddy host snippets
- `infra/containers/quadlet` - Podman systemd unit templates
- `infra/scripts` - local setup helpers

## Current status

This repository currently scaffolds the new runtime boundary and the first vertical slice foundation:

- token-based auth contract
- profile/home endpoints
- collection endpoint
- authenticated media endpoint contract
- Expo app shell with auth bootstrap and collection screen

The old PWA at `game.leaetzak.love` remains the behavior reference only.
