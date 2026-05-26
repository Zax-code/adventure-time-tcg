# CI/CD Runbook

This repo now ships with GitHub Actions workflows for validation, backend deployment, and mobile release orchestration.

## Workflow Overview

### `CI`

File: `.github/workflows/ci.yml`

Runs on pull requests, pushes to `main`, and manual dispatch.

What it does:

- installs Node.js `22.14.0` from `.nvmrc`
- runs `npm ci`
- runs `npm run typecheck`
- runs `npm run build`
- provisions PostgreSQL 16 for Phoenix tests
- runs `mix deps.get`
- runs `mix format --check-formatted`
- runs `mix compile --warnings-as-errors`
- runs `mix test`

This is the required branch-protection workflow for `main`.

### `Dependency Review`

File: `.github/workflows/dependency-review.yml`

Runs on pull requests and blocks dependency diffs that introduce vulnerabilities at `moderate` severity or above.

### `Deploy Phoenix`

File: `.github/workflows/deploy-phoenix.yml`

Runs automatically on pushes to `main` when backend/deploy-relevant files change, and can also be triggered manually.

What it does:

- uploads the repo-owned deploy script to the production host
- deploys an exact Git SHA or ref
- refuses to deploy from a dirty host checkout
- runs `mix deps.get --only prod`
- runs `mix compile`
- runs `mix ecto.migrate` unless manually skipped
- restarts the configured systemd service
- verifies `/ready` before reporting success

The production logic lives in `infra/scripts/deploy-phoenix.sh`, so deploy behavior is versioned with the application code.

### `Mobile Release Plan`

File: `.github/workflows/mobile-release-plan.yml`

Manual workflow that prepares release notes and commit summaries for Android, iOS, or both.

What it does:

- checks out a chosen ref
- runs `npm run typecheck`
- compares the target ref to the latest `mobile/android/*` and `mobile/ios/*` tags
- generates suggested store notes and a release plan artifact under `.release/`

Use this before cutting a store release if you want a reviewable artifact and a clean diff against the last shipped platform version.

### `Mobile Release`

File: `.github/workflows/mobile-release-self-hosted.yml`

Manual workflow intended for a self-hosted macOS runner that has Xcode, Android SDK tooling, EAS local build prerequisites, and signing material already installed.

What it does:

- checks out a chosen ref from `main`
- runs `npm ci`
- runs `npm run typecheck`
- generates platform release notes from git tags
- runs the existing local production release scripts
- pushes newly created `mobile/android/*` and `mobile/ios/*` tags back to GitHub

This workflow exists because production mobile builds in this repo must remain local, especially for iOS.

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

### Mobile production environment

Create a GitHub environment named `mobile-production` if you plan to use the self-hosted mobile release workflow.

The workflow assumes signing assets stay on the runner host rather than in GitHub secrets when possible.

Recommended runner-local environment variables:

- `APP_STORE_CONNECT_APP_ID`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_PATH`

The release scripts already know how to read those values.

## Self-Hosted macOS Runner Expectations

If you want GitHub-triggered local mobile releases, register the release Mac as a self-hosted runner with the `macOS` label.

Recommended tooling:

- Node.js `22.14.0`
- Xcode and command-line tools matching the current Expo SDK
- Android SDK and Java runtime for local `.aab` builds
- EAS local-build prerequisites
- local iOS signing files referenced by `apps/mobile/credentials.json`
- Google Play service-account JSON on disk

Keep the runner dedicated to release work if possible. That reduces signing drift and avoids surprise filesystem changes between releases.

## Branch Protection And Deployment Policy

Recommended GitHub settings:

- require `CI` before merging to `main`
- require linear history or squash merge to keep release diffing understandable
- restrict direct pushes to `main`
- require approvals for the `production` environment
- keep deploy concurrency to one production run at a time

## Production Host Expectations

The deploy workflow assumes:

- the repo is already cloned on the VPS at `/home/zax/adventure-time-tcg` unless overridden
- `apps/phoenix/.env` exists on the host
- the active service reads from that checkout
- passwordless `sudo` is available for `systemctl restart`
- the Phoenix service name is `adventure-time-tcg-api.service` unless overridden

Current checked-in service template:

- `infra/systemd-adventure-time-tcg-api.service`

Current Caddy reverse proxy template:

- `infra/caddy/app.leaetzak.love.Caddyfile`

## First-Time Setup Checklist

1. Add branch protection for `main` and require `CI`.
2. Create the `production` GitHub environment and add the backend deploy secrets.
3. Confirm the VPS repo path, systemd service name, and `/ready` health endpoint match reality.
4. Test `Deploy Phoenix` with `workflow_dispatch` against `main`.
5. Optionally register a self-hosted macOS runner and create the `mobile-production` environment.
6. Test `Mobile Release Plan`.
7. Test `Mobile Release` only after the self-hosted runner has confirmed local signing inputs.
