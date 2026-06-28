# Local Card Workflow

Use this reference when generating an Adventure Time TCG card.

## Source Of Truth

- Treat the running Docker/OrbStack PostgreSQL database as local truth.
- Use the `postgres` service in `compose.yml`: database `adventure_time_tcg`, user `postgres`.
- Use MinIO through the running stack for card images.
- Do not read, edit, diff against, or append to `apps/phoenix/priv/repo/seed_data/pvp_seed_catalog.json` for card creation.
- For live deployment, the VPS Phoenix service also uses `adventure_time_tcg`; prefer the DB from the running API env/Repo over similarly named legacy databases.

Useful checks from the repo root:

```bash
docker compose ps
node .agents/skills/generate-card/scripts/catalog-snapshot.mjs
docker compose exec -T postgres psql -U postgres -d adventure_time_tcg -c "SELECT count(*) FROM cards WHERE NOT is_archived;"
```

## Tables And Fields

Core tables:

- `rarities`: `id`, `name`, `drop_rate`, `color`
- `cards`: `id`, `name`, `character`, `description`, `hp`, `attack`, `defense`, `speed`, `type`, `rarity_id`, `image_asset_id`, `is_featured`, `is_archived`
- `ability_defs`: `id`, `key`, `name`, `name_fr`, `description`, `description_fr`, `type`, `cost`, `cooldown`, `once_per_match`, `payload`
- `card_abilities`: `card_id`, `passive_id`, `skill_id`, `ultimate_id`
- `image_assets`: `id`, `kind`, `mime_type`, `object_key`, `placeholder_svg`

Admin endpoints exist for card CRUD, ability CRUD, ability assignment, and card image upload:

- `POST /admin/cards`
- `PUT /admin/cards/:id`
- `POST /admin/cards/:id/image`
- `POST /admin/abilities`
- `POST /admin/abilities/assign`

Use the API/admin client when an authenticated admin session/token is available. If direct DB insertion is necessary for a local review draft, use one transaction, fixed UUIDs generated up front, and verify the result immediately. Prefer `is_archived=false` only when the user expects to see the card in local packs/loadouts; otherwise use `is_archived=true` for a private review draft.

## Art Handling

Existing card art is mostly landscape around `600x434`. Generate/edit the provided illustration toward that composition unless the current UI has changed. Keep the submitted art as the basis; crop or outpaint around it instead of replacing the subject.

Phoenix card upload accepts common image formats through `POST /admin/cards/:id/image`, then stores a `card` image asset and updates `cards.image_asset_id`. If bypassing the API, upload the image to MinIO with an object key shaped like `card/<card-id>/<uuid>` and insert a matching `image_assets` row with `kind='card'`.

After upload, verify:

```bash
docker compose exec -T postgres psql -U postgres -d adventure_time_tcg -c "SELECT id, kind, mime_type, object_key FROM image_assets WHERE id='<asset-id>';"
curl -fsS "http://127.0.0.1:4200/media/card/<asset-id>" >/tmp/card-image-check
```

## Ability Payload Vocabulary

Use only mechanics supported by the current Phoenix battle engine and shared game engine. Common, already-used keys include:

- `target`: `self`, `ally`, `enemy`, `allAllies`, `allEnemies`, `all`
- damage: `damageMul`, `hits`, `ignoreDefensePct`, `splashPct`, `executeThreshold`, `executeDamageMul`, `healPctOfDamage`
- statuses: `applyStatuses`, `applyStatusesToAttacker`, `applyStatusChance`, `randomDebuffs`, `randomStatuses`
- support: `shieldPctOfMaxHp`, `shieldTarget`, `healPctOfMaxHp`, `healLowestAllyPctOfDamage`, `cleanse`, `revivePct`
- cooldown/control: `reduceCooldowns`, `preventDeath`, `stealBuffCount`, `swapHpPercentages`
- passive: `trigger`, `chance`, `once`, `thresholdPct`, `statBonus`, `statBonusTarget`, `statBonusDurationMode`, `damageReduction`

Status names visible in the engines include `Burn`, `Freeze`, `GuardUp`, `Vulnerable`, `Weakened`, `Haste`, `Regeneration`, `Regen`, `Silence`, `Stunned`, `Poison`, `Empower`, `Mark`, `Barrier`, and `Doom`. Some older/local rows may use additional statuses; verify engine support before creating new ones.

Use existing ability scale:

- Skills usually cost `2` and have cooldown `2`.
- Ultimates usually cost `3`, are `once_per_match=true`, and have no cooldown.
- Passive abilities usually cost `0`.
- Single-target skills often use `damageMul` around `0.85` to `1.2`.
- AoE ultimates generally need lower multipliers or drawbacks.
- Strong hard-control or team-wide effects should trade off with lower damage, shorter duration, lower stats, or narrower targeting.

## Review Output

When finished, report:

- character sources used
- generated image path and/or image asset id
- card id, ability ids/keys, and rarity
- stats and why they fit nearby local cards
- ability payloads and why they are executable
- verification commands/results
- whether the card is active or archived locally

## Live Deployment Checks

Only use this section after explicit user approval to deploy a reviewed local draft.

- SSH target: `leaetzak`; repo path: `/home/zax/adventure-time-tcg`.
- Confirm `adventure-time-tcg-api.service`, `adventure-time-tcg-postgres.service`, `adventure-time-tcg-minio.service`, and `caddy` are active before and after the write.
- Back up `adventure_time_tcg` with `pg_dump -U postgres -Fc` before inserting rows.
- Use `env -u PHX_SERVER bin/adventure_time_api eval ...` for production release evals inside the API container.
- Plain `curl` can be blocked by Caddy's security matcher. Use an app/browser-like user agent for public verification.
