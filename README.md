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

## Testing On Expo Go From The VPS

This repo pins Node `22.14.0` in `.nvmrc`. On this VPS, Expo crashes under Node `25.x`, so the provided npm scripts switch to the pinned Node version before starting the dev server.

The mobile app is already configured to talk to the public API by default:

- `EXPO_PUBLIC_API_BASE_URL` defaults to `https://app.leaetzak.love`

If you want to override it, copy `apps/mobile/.env.example` to `apps/mobile/.env` and change the value there.

To start the Expo dev server in a way that works from an iPhone over the internet, run:

```bash
npm run dev:mobile:tunnel
```

That starts Expo in `--host tunnel` mode, which is the mode you want when the dev server is running on this VPS instead of your local LAN.

After it starts:

1. Open Expo Go on the iPhone.
2. Scan the QR code shown by the CLI.
3. Keep the terminal session running while testing.

If tunnel startup fails, the usual cause is Expo/ngrok connectivity or Expo account state on the server, not app code. In that case, rerun the same command in the foreground and use the printed error directly.
