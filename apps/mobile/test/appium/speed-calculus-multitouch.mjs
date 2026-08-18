import { spawn, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

const APP_ID = "love.leaetzak.adventuretime";
const APPIUM_HOME =
  process.env.APPIUM_HOME ??
  path.join(os.homedir(), ".cache", "adventure-time-tcg", "appium");
const HARNESS_URL = "adventure-time:///e2e-speed-calculus";
const DEFAULT_PORT = 4723;
const ELEMENT_ID_KEY = "element-6066-11e4-a52e-4f735466cecf";
let elementStrategy = "accessibility id";
const KEY_PAIRS = [
  ["1", "2"],
  ["4", "5"],
  ["7", "8"],
  ["1", "9"],
  ["2", "8"],
  ["3", "7"],
];
const POINTER_OFFSETS_MS = [0, 1, 4, 8, 16];

function parseOptions() {
  const { values } = parseArgs({
    options: {
      iterations: { type: "string", default: "20" },
      offsets: { type: "string" },
      platform: { type: "string", default: "ios" },
      port: { type: "string", default: String(DEFAULT_PORT) },
      udid: { type: "string" },
    },
    allowPositionals: false,
  });
  const platform = values.platform.toLowerCase();
  const iterations = Number.parseInt(values.iterations, 10);
  const port = Number.parseInt(values.port, 10);
  const offsets = (values.offsets ??
    (platform === "android" ? "0" : POINTER_OFFSETS_MS.join(",")))
    .split(",")
    .map((value) => Number(value.trim()));

  if (platform !== "ios" && platform !== "android") {
    throw new Error(`Unsupported platform "${values.platform}".`);
  }
  if (!Number.isInteger(iterations) || iterations < 1) {
    throw new Error("--iterations must be a positive integer.");
  }
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("--port must be a valid TCP port.");
  }
  if (
    offsets.length === 0 ||
    offsets.some((offset) => !Number.isInteger(offset) || offset < 0)
  ) {
    throw new Error("--offsets must be comma-separated non-negative integers.");
  }
  if (platform === "android" && offsets.some((offset) => offset !== 0)) {
    throw new Error(
      "UiAutomator2 only supports synchronized multi-pointer downs; Android offsets must be 0.",
    );
  }

  return {
    iterations,
    offsets,
    platform,
    port,
    udid: values.udid?.trim() || null,
  };
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed: ${result.stderr || result.stdout}`,
    );
  }
  return result.stdout.trim();
}

function findBootedIosSimulator() {
  const devices = JSON.parse(
    run("xcrun", ["simctl", "list", "devices", "booted", "--json"]),
  ).devices;

  for (const runtimeDevices of Object.values(devices)) {
    const booted = runtimeDevices.find(
      (device) => device.state === "Booted" && device.isAvailable !== false,
    );
    if (booted) return booted.udid;
  }

  throw new Error("No booted iOS simulator was found.");
}

function findAndroidDevice() {
  const device = run("adb", ["devices"])
    .split("\n")
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .find(([, state]) => state === "device");

  if (!device) {
    throw new Error("No connected Android emulator or device was found.");
  }
  return device[0];
}

function resolveDevice(platform, explicitUdid) {
  return explicitUdid ??
    (platform === "ios" ? findBootedIosSimulator() : findAndroidDevice());
}

function assertAppInstalled(platform, udid) {
  if (platform === "ios") {
    run("xcrun", ["simctl", "get_app_container", udid, APP_ID, "app"]);
    return;
  }

  const packagePath = run("adb", ["-s", udid, "shell", "pm", "path", APP_ID]);
  if (!packagePath.startsWith("package:")) {
    throw new Error(`The Android E2E app (${APP_ID}) is not installed on ${udid}.`);
  }
}

async function webdriverRequest(baseUrl, pathname, init = {}, allowNotFound = false) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const bodyText = await response.text();
  const body = bodyText ? JSON.parse(bodyText) : null;

  if (allowNotFound && response.status === 404) return null;
  if (!response.ok) {
    const detail = body?.value?.message ?? bodyText ?? response.statusText;
    throw new Error(`Appium ${init.method ?? "GET"} ${pathname} failed: ${detail}`);
  }

  return body?.value ?? body;
}

async function waitForAppium(baseUrl, server, serverLog) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Appium exited before startup:\n${serverLog.join("")}`);
    }

    try {
      await webdriverRequest(baseUrl, "/status");
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  throw new Error(`Appium did not become ready:\n${serverLog.join("")}`);
}

async function createSession(baseUrl, platform, udid) {
  const platformCapabilities =
    platform === "ios"
      ? {
          platformName: "iOS",
          "appium:automationName": "XCUITest",
          "appium:bundleId": APP_ID,
          "appium:udid": udid,
          "appium:noReset": true,
          "appium:newCommandTimeout": 120,
          "appium:wdaLaunchTimeout": 120_000,
        }
      : {
          platformName: "Android",
          "appium:automationName": "UiAutomator2",
          "appium:appPackage": APP_ID,
          "appium:appActivity": `${APP_ID}.MainActivity`,
          "appium:udid": udid,
          "appium:noReset": true,
          "appium:newCommandTimeout": 120,
        };

  const value = await webdriverRequest(baseUrl, "/session", {
    method: "POST",
    body: JSON.stringify({
      capabilities: { alwaysMatch: platformCapabilities, firstMatch: [{}] },
    }),
  });
  const sessionId = value?.sessionId;
  if (!sessionId) throw new Error("Appium did not return a session id.");
  return sessionId;
}

async function executeMobile(baseUrl, sessionId, script, args) {
  return webdriverRequest(baseUrl, `/session/${sessionId}/execute/sync`, {
    method: "POST",
    body: JSON.stringify({ script, args: [args] }),
  });
}

async function openHarness(baseUrl, sessionId, platform) {
  await executeMobile(baseUrl, sessionId, "mobile: deepLink", {
    url: HARNESS_URL,
    ...(platform === "ios" ? { bundleId: APP_ID } : { package: APP_ID }),
  });
}

async function findElement(baseUrl, sessionId, accessibilityId) {
  const locatorValue =
    elementStrategy === "-android uiautomator"
      ? `new UiSelector().resourceId("${accessibilityId}")`
      : accessibilityId;
  const value = await webdriverRequest(
    baseUrl,
    `/session/${sessionId}/element`,
    {
      method: "POST",
      body: JSON.stringify({ using: elementStrategy, value: locatorValue }),
    },
    true,
  );
  return value?.[ELEMENT_ID_KEY] ?? null;
}

async function waitForElement(baseUrl, sessionId, accessibilityId, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const elementId = await findElement(baseUrl, sessionId, accessibilityId);
    if (elementId) return elementId;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${accessibilityId}.`);
}

async function waitForAnyElement(baseUrl, sessionId, accessibilityIds) {
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    for (const accessibilityId of accessibilityIds) {
      const elementId = await findElement(baseUrl, sessionId, accessibilityId);
      if (elementId) return accessibilityId;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  const source = await webdriverRequest(baseUrl, `/session/${sessionId}/source`);
  const receivedAnswers = [
    ...new Set(
      String(source).match(/speed-calculus-answer-value-[^"<]+/g) ?? [],
    ),
  ];
  throw new Error(
    `Neither ${accessibilityIds.join(" nor ")} appeared. Visible answer ids: ${receivedAnswers.join(", ") || "none"}.`,
  );
}

async function elementCenter(baseUrl, sessionId, accessibilityId) {
  const elementId = await waitForElement(baseUrl, sessionId, accessibilityId);
  const rect = await webdriverRequest(
    baseUrl,
    `/session/${sessionId}/element/${elementId}/rect`,
  );
  return {
    x: Math.round(rect.x + rect.width / 2),
    y: Math.round(rect.y + rect.height / 2),
  };
}

function pointerMove(point) {
  return {
    type: "pointerMove",
    duration: 0,
    origin: "viewport",
    x: point.x,
    y: point.y,
  };
}

function touchSource(id, actions) {
  return {
    type: "pointer",
    id,
    parameters: { pointerType: "touch" },
    actions,
  };
}

async function performActions(baseUrl, sessionId, actions) {
  await webdriverRequest(baseUrl, `/session/${sessionId}/actions`, {
    method: "POST",
    body: JSON.stringify({ actions }),
  });
}

async function tap(baseUrl, sessionId, point) {
  await performActions(baseUrl, sessionId, [
    touchSource("reset-finger", [
      pointerMove(point),
      { type: "pointerDown", button: 0 },
      { type: "pause", duration: 30 },
      { type: "pointerUp", button: 0 },
    ]),
  ]);
}

async function twoFingerTap(baseUrl, sessionId, platform, first, second, offsetMs) {
  const holdMs = 30;
  const firstActions = [pointerMove(first), { type: "pointerDown", button: 0 }];
  const secondActions =
    offsetMs === 0
      ? [pointerMove(second), { type: "pointerDown", button: 0 }]
      : [
          // XCUITest needs the delayed pointer to exist before its target move.
          platform === "ios"
            ? pointerMove({ x: 1, y: 1 })
            : { type: "pause", duration: 0 },
          { type: "pause", duration: offsetMs },
          pointerMove(second),
          { type: "pointerDown", button: 0 },
        ];

  if (offsetMs > 0) {
    firstActions.push(
      { type: "pause", duration: offsetMs },
      { type: "pause", duration: 0 },
    );
  }

  firstActions.push(
    { type: "pause", duration: holdMs },
    { type: "pointerUp", button: 0 },
  );
  secondActions.push(
    { type: "pause", duration: holdMs },
    { type: "pointerUp", button: 0 },
  );

  await performActions(baseUrl, sessionId, [
    touchSource("finger-1", firstActions),
    touchSource("finger-2", secondActions),
  ]);
}

async function main() {
  const options = parseOptions();
  elementStrategy =
    options.platform === "android" ? "-android uiautomator" : "accessibility id";
  const udid = resolveDevice(options.platform, options.udid);
  assertAppInstalled(options.platform, udid);

  const appiumBin = path.resolve(import.meta.dirname, "../../../../node_modules/.bin/appium");
  const serverLog = [];
  const server = spawn(
    appiumBin,
    ["--address", "127.0.0.1", "--port", String(options.port), "--log-level", "warn"],
    {
      env: { ...process.env, APPIUM_HOME },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout.on("data", (chunk) => serverLog.push(chunk.toString()));
  server.stderr.on("data", (chunk) => serverLog.push(chunk.toString()));

  const baseUrl = `http://127.0.0.1:${options.port}`;
  let sessionId = null;

  try {
    await waitForAppium(baseUrl, server, serverLog);
    sessionId = await createSession(baseUrl, options.platform, udid);
    await openHarness(baseUrl, sessionId, options.platform);
    await waitForElement(baseUrl, sessionId, "speed-calculus-appium-harness", 30_000);
    const clearPoint = await elementCenter(
      baseUrl,
      sessionId,
      "speed-calculus-key-clear",
    );
    if (
      !(await findElement(
        baseUrl,
        sessionId,
        "speed-calculus-answer-value-empty",
      ))
    ) {
      await tap(baseUrl, sessionId, clearPoint);
    }
    await waitForElement(baseUrl, sessionId, "speed-calculus-answer-value-empty");

    const keyCenters = new Map();
    for (const pair of KEY_PAIRS) {
      for (const key of pair) {
        if (!keyCenters.has(key)) {
          keyCenters.set(
            key,
            await elementCenter(baseUrl, sessionId, `speed-calculus-key-${key}`),
          );
        }
      }
    }

    const commandDurations = [];
    for (let index = 0; index < options.iterations; index += 1) {
      const [firstKey, secondKey] = KEY_PAIRS[index % KEY_PAIRS.length];
      const offsetMs = options.offsets[index % options.offsets.length];
      const startedAt = performance.now();
      await twoFingerTap(
        baseUrl,
        sessionId,
        options.platform,
        keyCenters.get(firstKey),
        keyCenters.get(secondKey),
        offsetMs,
      );
      commandDurations.push(performance.now() - startedAt);

      const forward = `${firstKey}${secondKey}`;
      const reverse = `${secondKey}${firstKey}`;
      const answerId = await waitForAnyElement(baseUrl, sessionId, [
        `speed-calculus-answer-value-${forward}`,
        `speed-calculus-answer-value-${reverse}`,
      ]);
      const answer = answerId.slice("speed-calculus-answer-value-".length);
      process.stdout.write(
        `[${index + 1}/${options.iterations}] ${firstKey}+${secondKey}, ${offsetMs}ms offset -> ${answer}\n`,
      );

      await tap(baseUrl, sessionId, clearPoint);
      await waitForElement(baseUrl, sessionId, "speed-calculus-answer-value-empty");
    }

    const averageCommandMs =
      commandDurations.reduce((sum, duration) => sum + duration, 0) /
      commandDurations.length;
    process.stdout.write(
      `PASS: ${options.iterations}/${options.iterations} two-finger inputs registered on ${options.platform} (${udid}).\n`,
    );
    process.stdout.write(
      `Average Appium action round trip: ${averageCommandMs.toFixed(1)}ms (includes the 30ms touch hold).\n`,
    );
  } finally {
    if (sessionId) {
      await webdriverRequest(baseUrl, `/session/${sessionId}`, { method: "DELETE" }).catch(
        () => undefined,
      );
    }
    server.kill("SIGTERM");
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
