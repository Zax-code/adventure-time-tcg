import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { parseArgs } from "node:util";

const DEFAULT_PACKAGE_NAME = "love.leaetzak.adventuretime";
const DEFAULT_PROFILE = "production";
const DEFAULT_TRACK = "internal";
const DEFAULT_LOCALE = "en-US";
const DEFAULT_SERVICE_ACCOUNT_PATH = path.resolve(
  import.meta.dirname,
  "../credentials.json",
);

function printHelp() {
  process.stdout.write(`Usage: npm run release:android -w @adventure-time/mobile -- --note "<text>" [options]\n\nOptions:\n  --note <text>            Short Google Play release note\n  --locale <code>          Play note locale (default: ${DEFAULT_LOCALE})\n  --track <name>           Play track to update (default: ${DEFAULT_TRACK})\n  --profile <name>         EAS build/submit profile (default: ${DEFAULT_PROFILE})\n  --package <name>         Android package name (default: ${DEFAULT_PACKAGE_NAME})\n  --service-account <path> Service account JSON path\n  --message <text>         Optional EAS build message\n  --help                   Show this help\n`);
}

function parseCliOptions() {
  const { values } = parseArgs({
    options: {
      help: { type: "boolean" },
      locale: { type: "string" },
      message: { type: "string" },
      note: { type: "string" },
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
    packageName: values.package?.trim() || DEFAULT_PACKAGE_NAME,
    profile: values.profile?.trim() || DEFAULT_PROFILE,
    serviceAccountPath:
      values["service-account"]?.trim() ||
      process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_PATH ||
      DEFAULT_SERVICE_ACCOUNT_PATH,
    track: values.track?.trim() || DEFAULT_TRACK,
  };
}

function ensureServiceAccountConfigured(serviceAccountPath) {
  if (process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON) {
    return;
  }

  if (!existsSync(serviceAccountPath)) {
    throw new Error(
      `Google Play service account key not found at ${serviceAccountPath}.`,
    );
  }
}

function runCommand(command, args, { cwd }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ["inherit", "pipe", "pipe"],
    });
    let stdout = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk.toString());
    });
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

function parseJsonOutput(stdout, label) {
  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error(`Failed to parse JSON output from ${label}.`);
  }
}

function extractBuildId(buildOutput) {
  if (Array.isArray(buildOutput)) {
    return buildOutput[0]?.id ?? "";
  }

  return buildOutput?.id ?? "";
}

function buildSubmitProfile(existingConfig, profileName, serviceAccountPath) {
  const submit = existingConfig.submit ?? {};
  const currentProfile = submit[profileName] ?? {};
  const currentAndroid = currentProfile.android ?? {};

  return {
    ...existingConfig,
    submit: {
      ...submit,
      [profileName]: {
        ...currentProfile,
        android: {
          ...currentAndroid,
          serviceAccountKeyPath: serviceAccountPath,
        },
      },
    },
  };
}

async function withTemporarySubmitProfile(
  mobileRoot,
  profileName,
  serviceAccountPath,
  callback,
) {
  const easConfigPath = path.join(mobileRoot, "eas.json");
  const originalContents = await readFile(easConfigPath, "utf8");
  const parsedConfig = JSON.parse(originalContents);
  const relativeServiceAccountPath = path.relative(
    mobileRoot,
    serviceAccountPath,
  );
  const patchedConfig = buildSubmitProfile(
    parsedConfig,
    profileName,
    relativeServiceAccountPath.startsWith(".")
      ? relativeServiceAccountPath
      : `./${relativeServiceAccountPath}`,
  );

  await writeFile(
    easConfigPath,
    `${JSON.stringify(patchedConfig, null, 2)}\n`,
    "utf8",
  );

  try {
    return await callback();
  } finally {
    await writeFile(easConfigPath, originalContents, "utf8");
  }
}

async function main() {
  const options = parseCliOptions();
  ensureServiceAccountConfigured(options.serviceAccountPath);

  const mobileRoot = path.resolve(import.meta.dirname, "..");
  const buildArgs = [
    "eas-cli",
    "build",
    "--platform",
    "android",
    "--profile",
    options.profile,
    "--non-interactive",
    "--wait",
    "--json",
  ];

  if (options.message) {
    buildArgs.push("--message", options.message);
  }

  const buildOutput = parseJsonOutput(
    await runCommand("npx", buildArgs, { cwd: mobileRoot }),
    "eas build",
  );
  const buildId = extractBuildId(buildOutput);

  if (!buildId) {
    throw new Error("Failed to extract the EAS build id from build output.");
  }

  const buildDetails = parseJsonOutput(
    await runCommand("npx", ["eas-cli", "build:view", buildId, "--json"], {
      cwd: mobileRoot,
    }),
    "eas build:view",
  );
  const versionCode = String(buildDetails.appBuildVersion ?? "").trim();

  if (!versionCode) {
    throw new Error(
      `Build ${buildId} did not return an Android versionCode in appBuildVersion.`,
    );
  }

  await withTemporarySubmitProfile(
    mobileRoot,
    options.profile,
    options.serviceAccountPath,
    async () =>
      runCommand(
        "npx",
        [
          "eas-cli",
          "submit",
          "--platform",
          "android",
          "--profile",
          options.profile,
          "--id",
          buildId,
          "--non-interactive",
          "--wait",
        ],
        { cwd: mobileRoot },
      ),
  );
  await runCommand(
    "node",
    [
      path.resolve(import.meta.dirname, "./set-play-release-notes.mjs"),
      "--version-code",
      versionCode,
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
    ],
    { cwd: mobileRoot },
  );

  process.stdout.write(
    `Android release complete for build ${buildId} (versionCode ${versionCode}).\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
