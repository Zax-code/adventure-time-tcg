---
name: release-adventure-time-mobile
description: Release the Adventure Time TCG Expo mobile app from the Mac using the repo's local iOS and Android release scripts. Use when the user asks to release iOS, release Android, release both platforms, ship a mobile build, create TestFlight/Google Play releases, prepare mobile release notes, bump mobile app version metadata, or preserve/update the mobile release tag trail.
---

# Release Adventure Time Mobile

## Operating Rule

Treat a mobile release as a production operation. Before running a build or submit command, read [references/release-runbook.md](references/release-runbook.md) and follow it as the source of truth for commands, files, gates, and stop conditions.

Never add or rely on GitHub Actions for mobile build or store release work. Release from `/Users/zax/Develop/adventure-time-tcg` on this Mac unless the user explicitly names another checkout.

## Release Workflow

1. Establish the target.
   - Infer `both` when the user says "release" without a platform.
   - Use `ios`, `android`, or `both` exactly as the release script expects.
   - If the user asks not to build or not to bump versions, honor that explicitly and call it out in the final report.
   - Completion criterion: target platform(s), build intent, and version-bump intent are known.

2. Prepare a release branch.
   - Start from fresh `main`: `git switch main && git pull --ff-only origin main`.
   - If the worktree contains unrelated user changes, preserve them; use the secondary worktree or ask only if continuing would risk overwriting work.
   - Create a fresh `codex/` branch for the release changes.
   - Completion criterion: the release runs from a clean, current branch based on `origin/main`.

3. Build the release plan.
   - Inspect current mobile version metadata and latest `mobile/ios/*` and `mobile/android/*` tags.
   - Diff each target platform from its latest tag to `HEAD`; use those diffs for release notes.
   - If a platform has no tag, treat this as its first true release and let the release trace script backfill or create the baseline.
   - Completion criterion: every target platform has a note, baseline, and intended version/build metadata.

4. Bump and verify before release.
   - Bump mobile app version metadata before building unless the user opted out.
   - Commit the bump and any release-prep changes before invoking release scripts, so generated tags point at an immutable release commit.
   - Run `npm run typecheck` and `cd apps/mobile && npx expo-doctor`.
   - Treat new Expo Doctor findings as blockers. The checked-in native project warning is acceptable only if it is unchanged and the only finding.
   - Completion criterion: release commit exists and verification is green or the exact blocker is reported.

5. Execute the release locally.
   - Use `npm run release:mobile -- --platform <ios|android|both> ...`.
   - For Android, pass `--android-note`; the default Google Play target is closed testing (`alpha`). Do not ship Android without a Google Play release note.
   - For iOS, pass `--ios-note` when a useful release note label exists, even though the local uploader does not publish TestFlight changelog text.
   - Stop on missing signing, App Store Connect, EAS, or Google Play credentials and report the exact missing input.
   - Completion criterion: each target platform's script reports success and creates or confirms its release tag.

6. Finish the repository trail.
   - Inspect `git status`, new platform tags, and relevant release output.
   - Push the branch and release tags before finishing unless the user explicitly told you not to push.
   - Open a pull request for the release branch; do not merge it.
   - Completion criterion: branch, commit, tags, PR URL, verification, and operational follow-up are all reported.

## Final Report

Report:
- platform(s) released
- version and build numbers/tags produced
- release notes used
- verification commands and results
- branch, commit, pushed tags, and PR URL
- any missing credentials, store-side follow-up, or tags the user still needs to push
