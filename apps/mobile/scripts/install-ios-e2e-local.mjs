import { existsSync, rmSync } from "node:fs";
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";

const DEFAULT_ARCHIVE_PATH = path.resolve(
  import.meta.dirname,
  "../local-build/ios-e2e.tar.gz",
);
const DEFAULT_UNPACK_DIR = path.resolve(
  import.meta.dirname,
  "../local-build/ios-e2e-unpacked",
);
const DEFAULT_UNPACKED_APP_PATH = path.resolve(
  DEFAULT_UNPACK_DIR,
  "AdventureTimeNative.app",
);
const IOS_BUNDLE_ID = "love.leaetzak.adventuretime";

function printHelp() {
  process.stdout.write(
    `Usage: npm run install:mobile:e2e:ios -- [options]\n\nOptions:\n  --archive <path>   Path to local E2E archive or .app bundle (default: prefers fresh archive ${DEFAULT_ARCHIVE_PATH}, otherwise ${DEFAULT_UNPACKED_APP_PATH})\n  --help             Show this help\n`,
  );
}

function parseCliOptions() {
  const { values } = parseArgs({
    options: {
      archive: { type: "string" },
      help: { type: "boolean" },
    },
    allowPositionals: false,
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  const archivePath =
    values.archive?.trim() ||
    (existsSync(DEFAULT_ARCHIVE_PATH)
      ? DEFAULT_ARCHIVE_PATH
      : DEFAULT_UNPACKED_APP_PATH);

  return {
    archivePath,
  };
}

function run(command, args) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

async function findAppBundle(dir) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.endsWith(".app")) {
        return entryPath;
      }

      const nested = await findAppBundle(entryPath);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

function listAvailableSimulators() {
  const output = run("xcrun", ["simctl", "list", "devices", "available"]);
  return output
    .split("\n")
    .filter((line) => line.includes("iPhone"))
    .map((line) => line.replace(/\s+\(.+$/, "").trim());
}

function ensureBootedSimulator() {
  const booted = run("xcrun", ["simctl", "list", "devices", "booted"]);
  if (booted.includes("Booted")) {
    return;
  }

  const simulatorName = listAvailableSimulators()[0];
  if (!simulatorName) {
    throw new Error("No available iPhone simulators were found.");
  }

  execFileSync("open", ["-a", "Simulator"], { stdio: "ignore" });
  execFileSync("xcrun", ["simctl", "boot", simulatorName], { stdio: "ignore" });

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const nextBooted = run("xcrun", ["simctl", "list", "devices", "booted"]);
    if (nextBooted.includes(simulatorName)) {
      return;
    }

    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
  }

  throw new Error("iOS simulator did not boot in time.");
}

async function resolveAppBundle(archivePath) {
  if (archivePath.endsWith(".app")) {
    return archivePath;
  }

  rmSync(DEFAULT_UNPACK_DIR, { force: true, recursive: true });
  await mkdir(DEFAULT_UNPACK_DIR, { recursive: true });

  execFileSync("tar", ["-xzf", archivePath, "-C", DEFAULT_UNPACK_DIR], {
    stdio: "inherit",
  });

  const appBundle = await findAppBundle(DEFAULT_UNPACK_DIR);
  if (!appBundle) {
    throw new Error(`Could not locate an .app bundle inside ${archivePath}.`);
  }

  return appBundle;
}

async function main() {
  const { archivePath } = parseCliOptions();

  if (!existsSync(archivePath)) {
    throw new Error(`Missing local iOS E2E artifact at ${archivePath}.`);
  }

  const appBundle = await resolveAppBundle(archivePath);
  ensureBootedSimulator();

  try {
    execFileSync("xcrun", ["simctl", "uninstall", "booted", IOS_BUNDLE_ID], {
      stdio: "ignore",
    });
  } catch {}

  execFileSync("xcrun", ["simctl", "install", "booted", appBundle], {
    stdio: "inherit",
  });

  process.stdout.write(`Installed iOS E2E app from ${appBundle}.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
