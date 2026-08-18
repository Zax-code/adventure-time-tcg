# Mobile Startup / Resume Stall Investigation

Status: fix implemented and validated on iOS simulator

Last updated: 2026-08-10

## Reported behavior

- The app sometimes remains on a startup screen until it is force-closed and reopened.
- The issue has been observed on an iPhone.
- The strongest lifecycle clue is that it usually happens after the app was used earlier, left in the background for a long time, and later reopened without first being removed from the app switcher.
- Android behavior is not yet known.
- The affected screen is confirmed to be only the static splash artwork, with no loading dots or status text.

This identifies the affected surface:

- The static artwork comes from the iOS `SplashScreen.storyboard` and is held by `expo-splash-screen`.
- The React-owned `Preparing your adventure...` / `Reconnecting to the Candy Kingdom...` screen contains loading dots and status text, so it is not the screen involved in this report.
- The app therefore never successfully removes the native splash. Either one of the four local prerequisites remains false, or the one-shot native hide call silently does nothing.

## Confirmed startup defect

Startup is a one-shot readiness chain with no overall deadline or recoverable error state.

`apps/mobile/app/_layout.tsx` calls `SplashScreen.preventAutoHideAsync()` and only hides the native splash after all four local conditions are true:

- fonts loaded
- theme hydrated
- locale hydrated
- session hydrated

Theme and locale hydration are launched without error handling. Session hydration is awaited before `useBootstrap` enters its `try` / `finally` recovery block. A rejected or indefinitely pending native storage operation can therefore leave one of the hydration flags false forever. Force-closing creates a new JavaScript process and retries the one-shot operations, which explains why the next launch can work.

An isolated harness executed the real `useBootstrap` hook source with controlled dependencies:

```text
normal hydration: PASS -> ready
transient hydration failure: FAIL -> phase stayed hydrating
unhandled rejection: simulated one-shot SecureStore failure
```

This proves that a transient hydration failure can produce a permanent startup stall. It does not yet prove that SecureStore is the native trigger on the affected iPhone.

The confirmed static splash rules out the later API restoration phase as the direct blocker. `sessionHydrated` becomes true before `/me`, token refresh, installation-header creation, or the API request completes. Those operations may delay the React-owned reconnecting screen, but cannot retain the native splash once local boot has completed.

## Existing evidence

### Normal cold launches

Five controlled iOS simulator cold launches reached mounted app UI within ten seconds:

```text
cold-launch 1: PASS app UI mounted after 10s
cold-launch 2: PASS app UI mounted after 10s
cold-launch 3: PASS app UI mounted after 10s
cold-launch 4: PASS app UI mounted after 10s
cold-launch 5: PASS app UI mounted after 10s
```

The issue therefore needs a lifecycle or dependency fault condition and is not an unconditional cold-launch failure.

### Authenticated lifecycle loops

The iOS simulator was authenticated through the existing E2E session bridge before both loops.

Eight short background / foreground cycles all returned to the home tab and retained the same process identifier:

```text
same-process resume: 8/8 PASS
process identifier: 86825 throughout
```

Five background-then-eviction cycles all created a new process and returned to the home tab while the access token was still valid:

```text
eviction relaunch: 5/5 PASS
process identifiers: 86825 -> 88085 -> 88228 -> 88368 -> 88515 -> 88656
```

These results rule out an unconditional same-process resume defect and an unconditional authenticated cold-relaunch defect. They do not reproduce an intermittent native-storage fault.

The app was then left backgrounded until its test access token expired. The process was evicted and relaunched once more. The new process (`89693`) refreshed the session and reached the authenticated home tab within the bounded check:

```text
expired-access-token eviction relaunch: PASS
```

Access-token expiry by itself is therefore not sufficient to reproduce the stall.

### Network deadline

The API client in mobile version `1.0.18` aborts an HTTP fetch after eight seconds. Its request-deadline regression test passes. A fetch that has already started should therefore not leave session restoration pending forever.

However, the deadline begins only after access-token lookup and client-header construction. SecureStore access and installation-ID creation happen before the HTTP deadline and remain unbounded. Session persistence and cleanup after a response are also outside that deadline.

Because the reported surface is the native splash, these later network operations are no longer candidates for this specific stall. Only the earlier session hydration Keychain operations remain relevant.

### Native splash warning

The iOS simulator logs this message on every tested launch:

```text
Could not load the "SplashScreen" image referenced from a nib
```

All five launches with that warning succeeded, so the warning is not sufficient to cause the reported stall.

### Physical iPhone lifecycle evidence

The paired physical iPhone has Adventure Time TCG `1.0.18` build `53` installed. Its existing system Jetsam reports include the app as a suspended process in all eight inspected reports. In two reports, iOS selected the app as a victim with the reason `long-idle-exit`:

| Report date | App state | Kill reason |
| --- | --- | --- |
| 2026-08-03 08:40 | suspended | `long-idle-exit` |
| 2026-08-05 18:45 | suspended | `long-idle-exit` |

This confirms the user's lifecycle observation: after the app has remained in the background for a long time, tapping it can require a complete cold process launch even though it still appears in the app switcher. This is normal iOS process management rather than an app crash, but it exposes the app's fragile one-shot startup chain.

No conventional app crash, hang, spin, or watchdog report matching the symptom was found among the available device diagnostics.

## Lifecycle-focused hypotheses

Ranked for the reported long-background / resume scenario:

1. **A Keychain operation fails or remains pending during the cold relaunch.**
   Theme, locale, and session hydration all depend on SecureStore and none has a bounded fallback. An authenticated session cold launch performs three reads and then rewrites all three session values before setting `sessionHydrated`. Any rejected or pending operation permanently retains the native splash. Prediction: fault-injecting any one of these operations reproduces the static splash; phase telemetry identifies the corresponding hydration flag as false.

2. **A font load fails or remains pending.**
   `useFonts` returns an error value, but the root layout ignores it and waits only for `fontsLoaded`. Prediction: the affected launch records a font error while all three storage hydration flags are true.

3. **The one-shot native splash hide call silently no-ops.**
   Expo's iOS `SplashScreenManager.hide()` dispatches asynchronously and returns without an error if its root view is missing or its loading view is no longer considered visible. The app ignores the `hideAsync()` result and never retries because `localBootReady` stays true. Prediction: all four local prerequisites are true and React UI exists behind the retained native splash, but no successful native hide transition is recorded.

4. **A background task and foreground launch overlap with native splash/root-view setup.**
   The app defines notification and step-sync tasks at bundle startup. Expo Task Manager can load the JavaScript bundle while the app is terminated or backgrounded. The green same-process resume loop lowers this hypothesis. Expo's iOS implementation also separates foreground and headless task managers to avoid simultaneous-launch races, so only a rarer native root-view timing interaction remains plausible.

5. **iOS-only native lifecycle behavior is involved.**
   Prediction: the same background/resume stress loop remains green on Android while it can fail on iOS.

## Implemented resolution

The fix covers every path capable of retaining the confirmed native splash:

1. All startup SecureStore work has a five-second deadline and returns a typed timeout or rejection result instead of leaving a promise pending forever.
2. Theme and locale hydration always settle. Failure uses the existing safe defaults, records a sanitized failure category, and allows React to start.
3. Theme and locale values migrate to versioned `AFTER_FIRST_UNLOCK` Keychain entries so iOS background/prewarm timing is less likely to make them unavailable.
4. Session hydration always settles. Failure releases the native splash and shows an app-owned retry screen without discarding the saved session or silently treating the user as logged out.
5. Session Keychain accessibility migration now uses a marker and no longer rewrites all three session values on every authenticated cold launch.
6. Font loading failure or timeout uses system-font fallback rather than permanently retaining the native splash.
7. Native splash dismissal is attempted at `0`, `100`, `500`, and `1,500` milliseconds and again whenever the app becomes active. A single silent iOS no-op can no longer strand the splash.
8. Access-token lookup and installation-ID creation before API fetch are bounded. A failed installation-ID lookup uses a process-local identifier and cannot cache a rejected or indefinitely pending promise.
9. Session/user persistence and cleanup are bounded and preserve a valid in-memory state if native storage is temporarily unavailable.
10. Focused regression coverage exercises successful, rejected, and indefinitely pending startup work, font fallback, splash retry policy, real call-site wiring, and pre-request SecureStore bounds.

The exact native dependency that failed during the historical physical-device incidents cannot be recovered retrospectively. The implementation intentionally removes every permanent-wait outcome identified by the investigation rather than depending on one unprovable trigger.

## Verification

- focused startup recovery tests: passing
- mobile TypeScript check: passing
- mobile UI regression tests: passing
- quest and translation tests: passing
- React Doctor changed-file score: `100/100`
- Expo Doctor: no new finding from this change; existing dependency-version drift and the existing `expo-health-connect` maintenance warning remain
- fresh embedded iOS Release E2E build: passing
- authenticated Maestro smoke flow: passing
- same-process iOS resume loop: `8/8` passing with a stable process identifier
- iOS eviction/cold-relaunch loop: `5/5` passing with a new process each cycle
- Android lifecycle comparison: pending; no Android emulator was available during the investigation
