# Admin, E2E, and Release Rules

These rules are always active because release, E2E, and admin constraints often cross file boundaries.

## Admin

- Admin UI lives in `apps/mobile/app/admin/` and `apps/mobile/src/components/admin/`.
- Prefer the admin component layer: `AdminShell`, `AdminBackground`, `AdminPanel`, `AdminHero`, `AdminStat`, `AdminNotice`, `AdminSearchInput`, `AdminFilterChip`, `AdminButton`, `AdminModal`, and `AdminSheet`.
- Keep admin dense and operational rather than marketing-like.

## Maestro E2E

- Run Maestro through `scripts/maestro.sh` or npm scripts that call it.
- Set `MOBILE_TEST_PASSWORD` before Maestro runs.
- Prefer committed flows in `.maestro/`.
- Inspect Maestro screenshots/logs under `~/.maestro/tests/<timestamp>/` before changing app code after a failure.
- Do not commit generated `.maestro/.maestro-flow.*` files.

## Mobile Release Policy

- Mobile production build and release work happens from this Mac, not GitHub Actions.
- Always bump app version/build metadata first unless the user explicitly says not to.
- Use repo release scripts instead of ad hoc release commands.
- iOS release defaults to local App Store Connect upload tooling.
- Android release uses EAS/Google Play and requires a release note.
- Maintain independent platform release tags using `mobile/ios/*` and `mobile/android/*`.
- Do not add or rely on GitHub Actions for mobile builds or releases.

