# Speed Calculus Appium check

This focused check drives the production `AnswerBox` and `Keypad` through the
E2E-only `/e2e-speed-calculus` route. It sends two independent W3C touch
pointers and verifies that both digits reach the answer.

Install the pinned Appium drivers once, then build and install the E2E app
before running a platform check. The setup keeps the drivers in an isolated
user cache rather than changing another Appium project's drivers.

```sh
npm run setup:mobile:appium
```

```sh
npm run build:mobile:e2e:ios
npm run install:mobile:e2e:ios
npm run test:mobile:appium:speed-calculus:ios
```

```sh
npm run build:mobile:e2e:android
npm run install:mobile:e2e:android
npm run test:mobile:appium:speed-calculus:android
```

The test starts and stops its own local Appium server. iOS exercises pointer
down offsets of 0, 1, 4, 8, and 16 ms by default. Android's UiAutomator2
server only synthesizes a valid multi-pointer event when both pointers go down
in the same action tick, so its focused check uses a 0 ms offset.

To narrow or extend an iOS run:

```sh
node apps/mobile/test/appium/speed-calculus-multitouch.mjs \
  --platform ios --iterations 100 --offsets 0,1,4,8,16
```

Pass `--udid <device-id>` to select a particular installed simulator,
emulator, or compatible signed physical-device build.
