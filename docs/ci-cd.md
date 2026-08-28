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
- runs the website test suite when web-facing files change
- provisions PostgreSQL 16 for Phoenix validation
- runs `mix deps.get`
- runs `mix format --check-formatted`
- runs `mix compile --warnings-as-errors`
- runs `mix test`

The workspace build compiles the Vite website into Phoenix's static directory, so the release-image validation covers the browser bundle as well as the backend. This is the required branch-protection workflow for `main`.

### `Deploy Phoenix`

File: `.github/workflows/deploy-phoenix.yml`

Runs automatically on pushes to `main` when backend/deploy-relevant files change, and can also be triggered manually.

What it does:

- optionally connects the GitHub runner to Tailscale before SSH when tailnet credentials are configured
- builds and pushes the Phoenix release image, including the compiled website, to GHCR
- sends only a commit SHA and immutable image digest to a fixed, root-owned host deployer
- validates the image's revision label against the requested pushed commit
- creates and verifies a PostgreSQL custom-format recovery object before migrations
- pulls and verifies the immutable API image before stopping the API
- stops only the API for migrations and the image switch; PostgreSQL, MinIO,
  Caddy, and Prodigium are not restarted
- runs `AdventureTimeApi.Release.migrate` in a one-off container unless manually skipped
- restarts the Quadlet-generated systemd service
- verifies `/ready` before reporting success

The reviewed host boundary is installed from
`infra/scripts/deploy-phoenix-host.sh` and
`infra/scripts/adventure-time-tcg-deploy-ssh`. Repository changes to those
root-owned files require an explicit operator installation before a workflow
may depend on them.

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
- `PRODUCTION_KNOWN_HOSTS`: pinned Netcup SSH host keys

Recommended secrets:

- `PRODUCTION_SSH_PORT`: `2222` on Netcup (the workflow defaults to this value)

Optional Tailscale secrets for tailnet-only production hosts:

- `TS_OAUTH_CLIENT_ID`: recommended Tailscale OAuth client ID for ephemeral CI nodes; this can be stored as either a GitHub environment variable or a secret
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

- the dedicated `adventure-deploy` SSH account is restricted to the installed
  forced-command wrapper
- `/usr/local/sbin/deploy-adventure-time-tcg` is root-owned and the account has
  only its reviewed sudo allowlist
- the API container env file exists at
  `/home/zax/adventure-time-tcg-secrets/api.container.env`
- the host mail relay config exists at `/home/zax/adventure-time-tcg-secrets/msmtprc` so the containerized `sendmail` command can reach Postfix
- Podman is installed on the VPS
- the fixed host deployer owns the only permitted privileged deployment operations
- if the host is tailnet-only, the `production` GitHub environment includes working Tailscale credentials

Install the reviewed boundary as root before enabling the workflow:

```bash
install -o root -g root -m 0755 \
  infra/scripts/adventure-time-tcg-deploy-ssh \
  /usr/local/libexec/adventure-time-tcg-deploy-ssh
install -o root -g root -m 0755 \
  infra/scripts/deploy-phoenix-host.sh \
  /usr/local/sbin/deploy-adventure-time-tcg
visudo -cf infra/sudoers/adventure-time-tcg-deploy
install -o root -g root -m 0440 \
  infra/sudoers/adventure-time-tcg-deploy \
  /etc/sudoers.d/adventure-time-tcg-deploy
```

The dedicated account's only authorized key must use
`restrict,command="/usr/local/libexec/adventure-time-tcg-deploy-ssh"`. Never add
the workflow key to `zax` and never install its private half on a server.

Current checked-in Quadlet templates:

- `infra/containers/quadlet/adventure-time-tcg.pod`
- `infra/containers/quadlet/adventure-time-tcg-postgres.container`
- `infra/containers/quadlet/adventure-time-tcg-minio.container`
- `infra/containers/quadlet/adventure-time-tcg-api.container`

Current Caddy reverse proxy template:

- `infra/caddy/app.leaetzak.love.Caddyfile`

## First-Time Setup Checklist

1. Add branch protection for `main` and require `CI`.
2. Create the `production` GitHub environment and add the backend deploy secrets.
3. Confirm the VPS repo path, Quadlet directory, and secrets file paths match reality.
4. Test `Deploy Phoenix` with `workflow_dispatch` against `main`.
5. Keep mobile release credentials and EAS access on this Mac instead of GitHub.
