# PWA User Migration

This migration covers the narrowed scope agreed for the Adventure Time PWA to native cutover:

- allowlisted users
- admin flags from the allowlist
- user rows for allowlisted users
- coins and dust
- owned cards
- user-facing settings that native currently supports
  - display name
  - preferred step source
  - profile pictures copied into native MinIO

Not migrated yet:

- super-admin role semantics
- email verification state
- push subscriptions
- full notification settings
- language/theme preferences
- Fitbit OAuth tokens

## Source and target env files

By default the script reads:

- source PWA env: `~/adventure-time-tcg/.env.postgres.production.local`
- target native env: `apps/api/.env`

You can override these paths with:

- `PWA_ENV_FILE=/path/to/source.env`
- `NATIVE_ENV_FILE=/path/to/native.env`

## Commands

Run from the repo root.

Audit only:

```bash
npm run migrate:pwa-users:audit -w @adventure-time/api
```

Dry-run migration plan:

```bash
npm run migrate:pwa-users:dry-run -w @adventure-time/api
```

Apply migration:

```bash
npm run migrate:pwa-users:apply -w @adventure-time/api
```

Post-migration verification:

```bash
npm run migrate:pwa-users:verify -w @adventure-time/api
```

Reports are written to `.migration-reports/` by default.

## What the script does

1. Reads the PWA allowlist and only keeps users whose email is allowlisted.
2. Builds an admin details report including `isAdmin` and `isSuperAdmin`.
3. Upserts native `allowed_emails`.
4. Upserts native `users` for allowlisted users.
5. Upserts native `owned_cards` for those users.
6. Copies profile pictures into the native MinIO bucket:
   - managed PWA profile images are copied directly from the PWA private bucket
   - external or relative profile image URLs are fetched and re-uploaded into native MinIO
7. Creates native `image_assets` rows and links `users.avatar_asset_id`.

## Mapping rules

- `AllowedEmail.email` -> `allowed_emails.email`
- `AllowedEmail.isAdmin` -> `allowed_emails.is_admin`
- `User.coins` -> `users.coins`
- `User.dust` -> `users.dust`
- `UserSettings.displayName` -> `users.display_name`
- fallback display name: `User.name`
- preferred step source:
  - `fitbit` if the PWA user had a Fitbit account
  - otherwise `device_health`
- profile picture source priority:
  - `UserSettings.profilePicture`
  - fallback `User.image`

## Safety checks

The script refuses to proceed if:

- owned card IDs exist in PWA but not in native `cards`
- a PWA user ID collides with a different native email

## Rollback

Before running apply in production:

1. snapshot the native Postgres database
2. snapshot or version the native MinIO bucket
3. run `audit`
4. run `dry-run`

If rollback is needed:

1. restore the native Postgres snapshot
2. remove or restore imported profile objects in native MinIO
3. rerun `audit` to confirm the target is back to the expected baseline
