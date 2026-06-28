---
name: generate-card
description: Create a new Adventure Time TCG card from a provided illustration and character name. Use for card-generation tasks that require researching an Adventure Time character, adapting supplied art with image generation, designing fair stats/rarity/abilities/descriptions against the local Docker/OrbStack card database, inserting the draft into the local Phoenix admin/database workflow for review, and later deploying only after explicit approval.
---

# Generate Card

Create one review-ready card at a time. The local Docker/OrbStack Phoenix database is the source of truth for existing live cards. Do not use `apps/phoenix/priv/repo/seed_data/pvp_seed_catalog.json` as card-generation input or as the write target.

## Workflow

1. Confirm inputs: require a character name and a supplied illustration. If either is missing, ask for it.
2. Read `references/local-card-workflow.md` before making the card.
3. Run `node .agents/skills/generate-card/scripts/catalog-snapshot.mjs` from the repo root to inspect local rarity distribution, stat bands, ability payload vocabulary, and existing cards.
4. Research the character with web browsing. Prefer Adventure Time Wiki pages, then other cartoon wiki sources if needed. Capture concrete lore, personality, powers, episode context, and anything visible in the submitted illustration.
5. Design the card:
   - Choose a card name that matches the illustration moment, not just the character name.
   - Pick rarity from local distribution and gameplay interest, not fame alone.
   - Pick type from the existing type set: `Hero`, `Tech`, `Royalty`, `Candy`, `Undead`, `Ice`, `Fire`, `Magic`, `Demon`, `Cosmic`.
   - Keep stats inside nearby local bands unless the card is intentionally unusual and clearly compensated.
   - Prefer coherent ability reuse when the character already has suitable abilities; create new abilities only when the concept needs them.
   - Keep ability payloads inside mechanics already supported by the Phoenix battle engine and shared game-engine types.
   - Write a short Adventure Time-flavored description grounded in lore and the illustration. Make it playful without turning it into random joke text.
6. Produce card art from the provided illustration. Use the image generation/editing tool to crop, outpaint, or extend the art into the existing card-art feel; preserve the supplied illustration as the visual basis. Use a local review artifact and convert to an uploadable image format accepted by the Phoenix admin upload.
7. Add the card to local for review through the Phoenix admin/API/database workflow described in the reference. Do not deploy live in the initial generation pass.
8. Verify locally:
   - Re-run the catalog snapshot and compare the inserted draft.
   - Fetch the card through admin/API or DB to confirm card fields, image asset, and ability assignment.
   - Run the narrowest relevant Phoenix test if backend code changed; for data-only local card insertion, DB/API verification is enough.
9. Report the draft card, sources consulted, local insertion status, image path/asset id, and verification. State that live deployment is gated on explicit user approval.

## Balance Rules

- Common and Uncommon cards usually have no passive and reuse simple skill/ultimate patterns.
- Rare cards may have a stronger stat shape or one passive, but should avoid Legendary-level auras.
- Epic cards can combine stronger stats with a more distinctive passive or interaction.
- Legendary cards should feel iconic and exciting, but not strictly dominate every comparable card. If stats are high, make abilities narrower; if abilities are broad, keep stats restrained.
- Avoid known outliers such as archived joke cards when balancing.
- Use the existing card database, not memory, for final comparisons.

## Deployment Gate

When the user later approves the local draft for live deployment, inspect the current deployment path before acting. Confirm the live target, current branch/state, Phoenix service health, database backup posture, and media object handling. Then apply the smallest reviewed data change to the live host and verify through the live API. Never deploy a generated card just because the local draft was created.

Production deployment findings to reuse:

- On the VPS, the Phoenix production service intentionally uses the database named `adventure_time_tcg`; confirm the running API env/Repo target before writing live card data.
- The usual VPS SSH host alias is `leaetzak`, with the repo at `/home/zax/adventure-time-tcg`.
- Expected live services are `adventure-time-tcg-api.service`, `adventure-time-tcg-postgres.service`, `adventure-time-tcg-minio.service`, and `caddy`.
- Take a custom-format Postgres backup before inserting live card data, for example under `/home/zax/migration-backups/adventure-time-tcg-card-deploy-<timestamp>/`, using `pg_dump -U postgres -Fc adventure_time_tcg`.
- For one-off release evals inside the production API container, unset `PHX_SERVER` so the eval process does not try to bind port `4200`: `sudo podman exec adventure-time-tcg-api env -u PHX_SERVER bin/adventure_time_api eval '...'`.
- Public Caddy intentionally aborts scanner-like user agents including plain `curl`. Verify public HTTPS with an app/browser-like user agent, for example `-A 'AdventureTimeNative/29 CFNetwork/3860.600.12 Darwin/25.5.0'`.
- Verify media through both Phoenix on the VPS (`http://127.0.0.1:4200/media/card/<asset-id>`) and public Caddy (`https://app.leaetzak.love/media/card/<asset-id>`) using an allowed user agent.
