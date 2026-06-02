## Maestro smoke tests

These flows exercise the highest-risk mobile interaction shells we migrated during the Expo 56 / Expo UI pass.

Prerequisites:
- Phoenix running locally on `http://127.0.0.1:4200`
- dedicated E2E app installed with the scripts below
- Maestro CLI installed locally
- Test user prepared with `apps/phoenix/scripts/ensure-mobile-test-user.sh`

Run:

```bash
MOBILE_TEST_PASSWORD=password123 npm run build:mobile:e2e:ios
MOBILE_TEST_PASSWORD=password123 npm run install:mobile:e2e:ios
MOBILE_TEST_PASSWORD=password123 npm run test:mobile:e2e:ios
MOBILE_TEST_PASSWORD=password123 npm run test:mobile:e2e:pvp:ios

MOBILE_TEST_PASSWORD=password123 npm run build:mobile:e2e:android
MOBILE_TEST_PASSWORD=password123 npm run install:mobile:e2e:android
MOBILE_TEST_PASSWORD=password123 npm run test:mobile:e2e:android
MOBILE_TEST_PASSWORD=password123 npm run test:mobile:e2e:pvp:android
```

The flows expect:
- `mobile-test@leaetzak.love`
- the password supplied through `MOBILE_TEST_PASSWORD`

Coverage:
- authenticated session bootstrap through a real backend-issued token pair
- bottom-tab navigation
- gifts filter controls
- PvP mechanics/reference entry and dismissal
- settings modal entry with authenticated preferences visible
- deterministic PvP fixture setup with two E2E users, valid loadouts, and an in-progress match
- PvP match entry, combat log visibility, card long-press details, action modal, basic targeting, and end-turn confirmation

Implementation note:
- the smoke flow no longer types credentials into the app UI
- `scripts/maestro.sh` logs into the local Phoenix backend first, injects the returned tokens plus user payload into the deep link, and the `e2e-auth` screen applies that session before navigating to PvP
- the dedicated PvP flow also provisions a deterministic local match through `apps/phoenix/scripts/ensure-mobile-test-pvp-fixture.sh` before the app launches
- this keeps the PvP validation focused on post-auth UI behavior instead of the Expo dev-client or text-input automation path

Build profile notes:
- `e2e-ios` builds a simulator app with `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:4200`
- `e2e-android` builds an APK with `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:4200`
- both profiles avoid the Expo dev-client launcher so Maestro can `launchApp` directly
