import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { parseArgs } from "node:util";
import {
  ensureGooglePlayServiceAccountConfigured,
  resolveGooglePlayServiceAccountPath,
} from "./google-play-service-account.mjs";
import { recordMobileRelease } from "./release-trace.mjs";

const DEFAULT_PACKAGE_NAME = "love.leaetzak.adventuretime";
const DEFAULT_PROFILE = "production";
const DEFAULT_TRACK = "internal";
const DEFAULT_LOCALE = "en-US";
const DEFAULT_OUTPUT_PATH = path.resolve(
  import.meta.dirname,
  "../local-build/android-production.aab",
);

function printHelp() {
  process.stdout.write(
    `Usage: npm run release:android -w @adventure-time/mobile -- --note "<text>" [options]\n\nOptions:\n  --note <text>            Short Google Play release note\n  --locale <code>          Play note locale (default: ${DEFAULT_LOCALE})\n  --track <name>           Play track to update (default: ${DEFAULT_TRACK})\n  --profile <name>         EAS build/submit profile (default: ${DEFAULT_PROFILE})\n  --package <name>         Android package name (default: ${DEFAULT_PACKAGE_NAME})\n  --service-account <path> Service account JSON path\n  --message <text>         Optional EAS build message\n  --output <path>          Local .aab output path (default: ${DEFAULT_OUTPUT_PATH})\n  --help                   Show this help\n`,
  );
}

function parseCliOptions() {
  const { values } = parseArgs({
    options: {
      help: { type: "boolean" },
      locale: { type: "string" },
      message: { type: "string" },
      note: { type: "string" },
      output: { type: "string" },
      package: { type: "string" },
      profile: { type: "string" },
      "service-account": { type: "string" },
      track: { type: "string" },
    },
    allowPositionals: false,
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  const note = values.note?.trim();

  if (!note) {
    throw new Error("Missing required --note value.");
  }

  return {
    locale: values.locale?.trim() || DEFAULT_LOCALE,
    message: values.message?.trim() || "",
    note,
    outputPath: values.output?.trim() || DEFAULT_OUTPUT_PATH,
    packageName: values.package?.trim() || DEFAULT_PACKAGE_NAME,
    profile: values.profile?.trim() || DEFAULT_PROFILE,
    serviceAccountPath: resolveGooglePlayServiceAccountPath(
      values["service-account"],
    ),
    track: values.track?.trim() || DEFAULT_TRACK,
  };
}

function runCommand(command, args, { cwd, captureStdout = false }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: captureStdout ? ["inherit", "pipe", "pipe"] : "inherit",
    });
    let stdout = "";

    if (captureStdout) {
      child.stdout.on("data", (chunk) => {
        const text = chunk.toString();
        stdout += text;
        process.stdout.write(text);
      });
      child.stderr.on("data", (chunk) => {
        process.stderr.write(chunk.toString());
      });
    }

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(
        new Error(
          `Command failed with exit code ${code}: ${command} ${args.join(" ")}`,
        ),
      );
    });
  });
}

function extractVersionCodeFromBuildLogs(stdout) {
  const match = stdout.match(/Incrementing versionCode from \d+ to (\d+)/);
  return match?.[1]?.trim() || "";
}

async function main() {
  const mobileRoot = path.resolve(import.meta.dirname, "..");
  process.env.NODE_ENV ??= "production";
  process.env.EAS_NO_VCS ??= "1";
  process.env.EAS_BUILD_DISABLE_EXPO_DOCTOR_STEP ??= "1";

  const options = parseCliOptions();
  ensureGooglePlayServiceAccountConfigured(options.serviceAccountPath);
  await mkdir(path.dirname(options.outputPath), { recursive: true });

  const buildArgs = [
    "eas-cli",
    "build",
    "--platform",
    "android",
    "--profile",
    options.profile,
    "--local",
    "--output",
    options.outputPath,
    "--non-interactive",
  ];

  if (options.message) {
    buildArgs.push("--message", options.message);
  }

  const buildOutput = await runCommand("npx", buildArgs, {
    cwd: mobileRoot,
    captureStdout: true,
  });
  const versionCode = extractVersionCodeFromBuildLogs(buildOutput);

  if (!existsSync(options.outputPath)) {
    throw new Error(`Expected local Android artifact at ${options.outputPath}.`);
  }

  await runCommand(
    "npx",
    [
      "eas-cli",
      "submit",
      "--platform",
      "android",
      "--profile",
      options.profile,
      "--path",
      options.outputPath,
      "--non-interactive",
      "--wait",
    ],
    { cwd: mobileRoot },
  );
  await runCommand(
    "node",
    [
      path.resolve(import.meta.dirname, "./set-play-release-notes.mjs"),
      "--note",
      options.note,
      "--locale",
      options.locale,
      "--track",
      options.track,
      "--package",
      options.packageName,
      "--service-account",
      options.serviceAccountPath,
      ...(versionCode
        ? ["--version-code", versionCode]
        : ["--latest-version-code"]),
    ],
    { cwd: mobileRoot },
  );
  await recordMobileRelease({
    artifactPath: options.outputPath,
    buildNumber: versionCode,
    mobileRoot,
    note: options.note,
    platform: "android",
    profile: options.profile,
  });

  process.stdout.write(
    `Android release complete from local artifact ${options.outputPath}${versionCode ? ` (versionCode ${versionCode})` : ""}.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
