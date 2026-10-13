# Adventure Time Mobile Release Runbook

## Repo And Policy

Run from `/Users/zax/Develop/adventure-time-tcg` unless the user explicitly chooses another checkout.

Do not create GitHub Actions release automation. GitHub Actions validates and deploys Phoenix backend work only. Mobile builds and releases run locally on this Mac.

Prefer the repo release entry point:

```bash
npm run release:mobile -- --platform <ios|android|both> ...
```

Single-platform wrappers are available:

```bash
npm run release:mobile:ios -- ...
npm run release:mobile:android -- ...
```

Build-only commands are available, but a release request means build and release unless the user explicitly says otherwise:

```bash
npm run build:mobile:ios:local
npm run build:mobile:android:local
```

## Branch And Worktree Gate

1. Inspect state:

```bash
git status --short --branch
```

2. Refresh `main`:

```bash
git switch main
git pull --ff-only origin main
git fetch origin --tags --prune
```

3. Create a release branch:

```bash
git switch -c codex/mobile-release-YYYYMMDD
```

If the primary worktree is busy with unrelated changes, use `/Users/zax/Develop/adventure-time-tcg-agent-secondary` only after refreshing it:

```bash
cd /Users/zax/Develop/adventure-time-tcg-agent-secondary
git fetch origin --prune
git switch codex/agent-secondary
git merge --ff-only origin/main
git switch -c codex/mobile-release-YYYYMMDD
```

Never stash, reset, clean, or overwrite user work to make room for a release.

## Version Metadata

Bump app version/build metadata first unless the user explicitly says to keep versions unchanged.

Check current values:

```bash
node -e 'const p=require("./apps/mobile/package.json"); const a=require("./apps/mobile/app.json"); console.log({package:p.version, expo:a.expo.version})'
/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' apps/mobile/ios/AdventureTimeNative/Info.plist
/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' apps/mobile/ios/AdventureTimeNative/Info.plist
rg -n 'versionCode|versionName' apps/mobile/android/app/build.gradle
```

Keep these aligned for an app-version bump:

- `apps/mobile/package.json` `version`
- `apps/mobile/app.json` `expo.version`
- `apps/mobile/android/app/build.gradle` `versionName`
- `apps/mobile/ios/AdventureTimeNative/Info.plist` `CFBundleShortVersionString`

Build numbers:

- iOS `CFBundleVersion` must be valid for App Store Connect and higher than the previous uploaded build for the same app version.
- Android production uses EAS `autoIncrement` and `cli.appVersionSource: "remote"` in `apps/mobile/eas.json`; the release script parses the incremented `versionCode` from EAS build output when available.

After editing version metadata, run formatting only if the changed files need it. Commit the bump before release:

```bash
git add apps/mobile/package.json apps/mobile/app.json apps/mobile/android/app/build.gradle apps/mobile/ios/AdventureTimeNative/Info.plist
git commit -m "Bump mobile app version"
```

If other release-prep fixes are required, make focused commits before running the store release. Tags should point at the final release commit.

Use structured edits for JSON and plist values. Avoid broad formatting churn in generated native projects; touch only the version lines needed for the release.

## Platform Tag Baselines

Each platform has independent release history:

```bash
git tag --list 'mobile/ios/*' --sort=-creatordate | head
git tag --list 'mobile/android/*' --sort=-creatordate | head
```

Use the latest target-platform tag as the release-note diff baseline:

```bash
git log --oneline <latest-mobile-platform-tag>..HEAD
git diff --stat <latest-mobile-platform-tag>..HEAD
```

If a platform has no prior tag, treat this as that platform's first true release. The release trace script attempts to backfill from finished EAS store builds; if it cannot, it records the current release as the baseline.

The release scripts create annotated tags:

- iOS: `mobile/ios/<version>`
- Android: `mobile/android/<version>+<versionCode>` when the version code is known, otherwise `mobile/android/<version>`

After release, inspect and push tags:

```bash
git tag --list 'mobile/ios/*' --sort=-creatordate | head
git tag --list 'mobile/android/*' --sort=-creatordate | head
git push origin <tag-name>
```

For both-platform releases, push both new platform tags.

## Release Notes

Base notes on meaningful changes since each platform's latest tag.

Android requires a short Google Play release note:

```bash
--android-note "Short user-facing note"
```

iOS should carry a release note label for traceability even though the direct local upload path does not set TestFlight changelog text:

```bash
--ios-note "Short release label"
```

Keep notes concrete. Do not invent generic copy. Prefer one concise sentence if the diff is small.

## Verification Gate

Before store release, run:

```bash
npm run typecheck
cd apps/mobile && npx expo-doctor
```

Treat any new Expo Doctor warning or failure as a regression. The non-CNG warning about checked-in `ios/` and `android/` native config fields may remain only if unchanged and the only Expo Doctor finding; call it out in the final report.

For mobile behavior changes, run the narrowest stable Maestro flow for the touched surface. Use the project wrapper, not raw `maestro test`:

```bash
MOBILE_TEST_PASSWORD='<password>' ./scripts/maestro.sh test --platform ios .maestro/<flow>.yaml
MOBILE_TEST_PASSWORD='<password>' ./scripts/maestro.sh test --platform android .maestro/<flow>.yaml
```

If there is no stable flow and the changed surface is high risk, add or update a focused flow before relying on manual reasoning.

## Release Commands

Both platforms:

```bash
npm run release:mobile -- \
  --platform both \
  --android-note "Short Google Play note" \
  --ios-note "Short iOS release label"
```

Android only:

```bash
npm run release:mobile -- \
  --platform android \
  --android-note "Short Google Play note"
```

iOS only:

```bash
npm run release:mobile -- \
  --platform ios \
  --ios-note "Short iOS release label"
```

Useful Android options:

```bash
--android-locale en-US
--android-track alpha
--android-service-account /path/to/google-play-service-account.json
--android-profile production
--android-output apps/mobile/local-build/android-production.aab
```

Useful iOS options:

```bash
--ios-asc-app-id <app-store-connect-app-id>
--ios-api-key-id <key-id>
--ios-api-issuer <issuer-id>
--ios-api-key-path /path/to/AuthKey_<key-id>.p8
--ios-api-key-subject user
--ios-profile production
--ios-output apps/mobile/local-build/ios-production.ipa
```

Default behavior embedded in scripts:

- API base URL: `https://app.leaetzak.love`
- Android package: `love.leaetzak.adventuretime`
- Android track: `alpha` (Google Play closed testing)
- Android profile: `production`
- iOS profile label: `production`
- iOS upload: local `.ipa` via `xcrun altool`
- Android upload: local `.aab` via EAS submit and Google Play release-note update

## Credential Stop Conditions

Stop and report exact missing inputs if any required credential is absent.

iOS may require:

- `APP_STORE_CONNECT_APP_ID` or `--ios-asc-app-id`
- `APP_STORE_CONNECT_API_KEY_ID` or `--ios-api-key-id`
- `APP_STORE_CONNECT_API_ISSUER_ID` or `--ios-api-issuer`
- `APP_STORE_CONNECT_API_KEY_PATH`, `--ios-api-key-path`, or a matching `AuthKey_<id>.p8` in the script's standard private-key search locations
- signing material referenced by `apps/mobile/credentials.json`

Android may require:

- Google Play service account JSON, either configured locally or passed with `--android-service-account`
- signing material required by the EAS Android profile
- a valid Google Play release note passed as `--android-note`

Do not work around missing local signing or store credentials by adding GitHub automation.

## Finish And Publish

After successful release:

```bash
git status --short --branch
git log --oneline -1
git tag --list 'mobile/ios/*' --sort=-creatordate | head
git tag --list 'mobile/android/*' --sort=-creatordate | head
git push origin HEAD
git push origin <new-ios-tag> <new-android-tag>
```

Open a PR for the release branch. Do not merge it unless the user explicitly asks.

```bash
gh pr create \
  --base main \
  --head "$(git branch --show-current)" \
  --title "Release mobile <version>" \
  --body "<summary, verification, tags, and store follow-up>"
```

Final report must include:

- platform(s)
- version/build numbers
- generated tag names
- release notes used
- verification commands and results
- branch, commit, pushed tags, and PR URL
- store-side follow-up, especially TestFlight/App Store review or Google Play track promotion
