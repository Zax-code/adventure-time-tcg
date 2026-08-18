import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  isFontStartupSettled,
  runStartupTask,
  SPLASH_HIDE_RETRY_DELAYS_MS,
} from "../src/lib/startup-recovery.ts";

const rootLayoutSource = readFileSync("app/_layout.tsx", "utf8");
const sessionStoreSource = readFileSync(
  "src/stores/session-store.ts",
  "utf8",
);
const themeStoreSource = readFileSync("src/stores/theme-store.ts", "utf8");
const localeStoreSource = readFileSync("src/stores/locale-store.ts", "utf8");
const apiSource = readFileSync("src/lib/api.ts", "utf8");

describe("mobile startup recovery", () => {
  it("reports a successful startup dependency", async () => {
    const result = await runStartupTask(async () => "ready", 50);

    assert.deepEqual(result, { ok: true, value: "ready" });
  });

  it("turns a rejected startup dependency into a recoverable result", async () => {
    const result = await runStartupTask(async () => {
      throw new Error("secure storage unavailable");
    }, 50);

    assert.deepEqual(result, { ok: false, reason: "rejected" });
  });

  it("bounds a startup dependency that never settles", async () => {
    const startedAt = Date.now();
    const result = await runStartupTask(
      () => new Promise<never>(() => undefined),
      20,
    );

    assert.deepEqual(result, { ok: false, reason: "timeout" });
    assert.ok(
      Date.now() - startedAt < 200,
      "startup dependency timeout should remain a tight feedback loop",
    );
  });

  it("allows bundled-font failure or timeout to use the system fallback", () => {
    assert.equal(
      isFontStartupSettled({ loaded: false, failed: true, timedOut: false }),
      true,
    );
    assert.equal(
      isFontStartupSettled({ loaded: false, failed: false, timedOut: true }),
      true,
    );
    assert.equal(
      isFontStartupSettled({ loaded: false, failed: false, timedOut: false }),
      false,
    );
  });

  it("keeps retrying native splash dismissal after the initial attempt", () => {
    assert.deepEqual(SPLASH_HIDE_RETRY_DELAYS_MS, [0, 100, 500, 1_500]);
  });

  it("wires bounded failure recovery into every native-splash dependency", () => {
    assert.match(rootLayoutSource, /isFontStartupSettled/);
    assert.match(
      rootLayoutSource,
      /useNativeSplashDismissal\(localBootReady\)/,
    );
    assert.match(sessionStoreSource, /runStartupTask\(async \(\) =>/);
    assert.match(
      sessionStoreSource,
      /hydrated: true,[\s\S]*?bootstrapPhase: "error"/,
    );
    assert.match(
      themeStoreSource,
      /keychainAccessible: SecureStore\.AFTER_FIRST_UNLOCK/,
    );
    assert.match(
      localeStoreSource,
      /keychainAccessible: SecureStore\.AFTER_FIRST_UNLOCK/,
    );
  });

  it("bounds secure storage used before API request deadlines begin", () => {
    assert.match(
      apiSource,
      /runStartupTask\(\(\) => SecureStore\.getItemAsync\(key\)\)/,
    );
    assert.match(
      apiSource,
      /return result\.ok \? result\.value : Crypto\.randomUUID\(\)/,
    );
  });
});
