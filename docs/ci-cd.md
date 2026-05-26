# CI/CD Runbook

This repo now ships with GitHub Actions workflows for validation and Phoenix backend deployment.

## Workflow Overview

### `CI`

File: `.github/workflows/ci.yml`

Runs on pull requests, pushes to `main`, and manual dispatch.

What it does:

- installs Node.js `22.14.0` from `.nvmrc`
- runs `npm ci`
- runs `npm run typecheck`
- runs `npm run build`
- provisions PostgreSQL 16 for Phoenix validation
- runs `mix deps.get`
- runs `mix format --check-formatted`
- runs `mix compile --warnings-as-errors`
- runs `mix test`

This is the required branch-protection workflow for `main`.

### `Deploy Phoenix`

File: `.github/workflows/deploy-phoenix.yml`

Runs automatically on pushes to `main` when backend/deploy-relevant files change, and can also be triggered manually.

What it does:

- optionally connects the GitHub runner to Tailscale before SSH when tailnet credentials are configured
- uploads the repo-owned deploy script to the production host
- deploys an exact Git SHA or ref
- refuses to deploy from a dirty host checkout
- runs `mix deps.get --only prod`
- runs `mix compile`
- runs `mix ecto.migrate` unless manually skipped
- restarts the configured systemd service
- verifies `/ready` before reporting success

The production logic lives in `infra/scripts/deploy-phoenix.sh`, so deploy behavior is versioned with the application code.

## Mobile Release Policy

Mobile builds and releases do not run on GitHub Actions.

Current policy:

- build mobile from this Mac, not on GitHub runners
- use EAS for build/submission workflows
- keep GitHub focused on validation and backend deployment
- open a pull request for code review first; merge is manual

## GitHub Environments And Secrets

### Production environment

Create a GitHub environment named `production` and protect it with the reviewers you want for backend production deploys.

Required secrets:

- `PRODUCTION_HOST`: hostname or IP of the VPS
- `PRODUCTION_SSH_USER`: SSH user for deploys
- `PRODUCTION_SSH_PRIVATE_KEY`: private key allowed to SSH into the VPS

Recommended secrets:

- `PRODUCTION_SSH_PORT`: defaults to `22`
- `PRODUCTION_REPO_PATH`: defaults to `/home/zax/adventure-time-tcg`
- `PRODUCTION_SYSTEMD_SERVICE`: defaults to `adventure-time-tcg-api.service`
- `PRODUCTION_HEALTHCHECK_URL`: optional override; by default deploy checks `http://127.0.0.1:$PHX_PORT/ready`

Optional Tailscale secrets for tailnet-only production hosts:

- `TS_OAUTH_CLIENT_ID`: recommended Tailscale OAuth client ID for ephemeral CI nodes
- `TS_OAUTH_SECRET`: recommended Tailscale OAuth secret; the client needs writable `auth_keys` scope and permission to advertise `tag:ci`
- `TS_AUTHKEY`: fallback auth key if you do not want to use OAuth yet

Tailscale host notes:

- if `PRODUCTION_HOST` is only reachable over Tailscale, prefer the full MagicDNS hostname or the node's `100.x` Tailscale IP
- the workflow now attempts Tailscale first when those secrets are present, then fails early with a clearer resolution error before SSH

## Branch Protection And Deployment Policy

Recommended GitHub settings:

- require `CI` before merging to `main`
- require linear history or squash merge to keep release diffing understandable
- restrict direct pushes to `main`
- require approvals for the `production` environment
- keep deploy concurrency to one production run at a time
- merge pull requests manually after review

## Production Host Expectations

The deploy workflow assumes:

- the repo is already cloned on the VPS at `/home/zax/adventure-time-tcg` unless overridden
- `apps/phoenix/.env` exists on the host
- the active service reads from that checkout
- passwordless `sudo` is available for `systemctl restart`
- the Phoenix service name is `adventure-time-tcg-api.service` unless overridden
- if the host is tailnet-only, the `production` GitHub environment includes working Tailscale credentials

Current checked-in service template:

- `infra/systemd-adventure-time-tcg-api.service`

Current Caddy reverse proxy template:

- `infra/caddy/app.leaetzak.love.Caddyfile`

## First-Time Setup Checklist

1. Add branch protection for `main` and require `CI`.
2. Create the `production` GitHub environment and add the backend deploy secrets.
3. Confirm the VPS repo path, systemd service name, and `/ready` health endpoint match reality.
4. Test `Deploy Phoenix` with `workflow_dispatch` against `main`.
5. Keep mobile release credentials and EAS access on this Mac instead of GitHub.
