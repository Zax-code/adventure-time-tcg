import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { parseArgs } from "node:util";
import { buildIosLocally } from "./ios-local-build.mjs";
import { recordMobileRelease } from "./release-trace.mjs";

const DEFAULT_PROFILE = "production";
const DEFAULT_GROUPS = [];
const DEFAULT_OUTPUT_PATH = path.resolve(
  import.meta.dirname,
  "../local-build/ios-production.ipa",
);

async function readEnvValueFromFile(filePath, key) {
  if (!existsSync(filePath)) {
    return "";
  }

  const contents = await readFile(filePath, "utf8");

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const candidateKey = trimmed.slice(0, separatorIndex).trim();
    if (candidateKey !== key) {
      continue;
    }

    return trimmed
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
  }

  return "";
}

async function readLocalEnvValue(mobileRoot, key) {
  const envLocalValue = await readEnvValueFromFile(
    path.join(mobileRoot, ".env.local"),
    key,
  );

  if (envLocalValue) {
    return envLocalValue;
  }

  return readEnvValueFromFile(path.join(mobileRoot, ".env"), key);
}

function printHelp() {
  process.stdout.write(
    `Usage: npm run release:ios -w @adventure-time/mobile -- --asc-app-id <id> [options]\n\nOptions:\n  --asc-app-id <id>         App Store Connect Apple ID for the app\n  --group <name>            Internal TestFlight group to add (repeatable)\n  --note <text>             Optional local release note label\n  --profile <name>          EAS submit profile (default: ${DEFAULT_PROFILE})\n  --output <path>           Local .ipa output path (default: ${DEFAULT_OUTPUT_PATH})\n  --help                    Show this help\n`,
  );
}

async function parseCliOptions(mobileRoot) {
  const { values } = parseArgs({
    options: {
      "asc-app-id": { type: "string" },
      group: { type: "string", multiple: true },
      help: { type: "boolean" },
      note: { type: "string" },
      output: { type: "string" },
      profile: { type: "string" },
    },
    allowPositionals: false,
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  const localAscAppId = await readLocalEnvValue(
    mobileRoot,
    "APP_STORE_CONNECT_APP_ID",
  );

  const ascAppId =
    values["asc-app-id"]?.trim() ||
    process.env.APP_STORE_CONNECT_APP_ID?.trim() ||
    process.env.EXPO_ASC_APP_ID?.trim() ||
    localAscAppId ||
    "";

  if (!ascAppId) {
    throw new Error(
      "Missing App Store Connect app id. Pass --asc-app-id or set APP_STORE_CONNECT_APP_ID.",
    );
  }

  return {
    ascAppId,
    groups: (values.group ?? DEFAULT_GROUPS)
      .map((group) => group.trim())
      .filter(Boolean),
    note: values.note?.trim() || "",
    outputPath: values.output?.trim() || DEFAULT_OUTPUT_PATH,
    profile: values.profile?.trim() || DEFAULT_PROFILE,
  };
}

function runCommand(command, args, { cwd }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
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

function buildPatchedEasConfig(existingConfig, profileName, ascAppId) {
  const submit = existingConfig.submit ?? {};
  const currentProfile = submit[profileName] ?? {};
  const currentIos = currentProfile.ios ?? {};

  return {
    ...existingConfig,
    submit: {
      ...submit,
      [profileName]: {
        ...currentProfile,
        ios: {
          ...currentIos,
          ascAppId,
        },
      },
    },
  };
}

async function withTemporarySubmitProfile(
  mobileRoot,
  profileName,
  ascAppId,
  callback,
) {
  const easConfigPath = path.join(mobileRoot, "eas.json");
  const originalContents = await readFile(easConfigPath, "utf8");
  const parsedConfig = JSON.parse(originalContents);
  const patchedConfig = buildPatchedEasConfig(
    parsedConfig,
    profileName,
    ascAppId,
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
  const mobileRoot = path.resolve(import.meta.dirname, "..");
  process.env.NODE_ENV ??= "production";
  process.env.EAS_NO_VCS ??= "1";
  process.env.EAS_BUILD_DISABLE_EXPO_DOCTOR_STEP ??= "1";

  const options = await parseCliOptions(mobileRoot);
  await mkdir(path.dirname(options.outputPath), { recursive: true });

  await withTemporarySubmitProfile(
    mobileRoot,
    options.profile,
    options.ascAppId,
    async () => {
      await buildIosLocally({
        mobileRoot,
        outputPath: options.outputPath,
      });

      if (!existsSync(options.outputPath)) {
        throw new Error(`Expected local iOS artifact at ${options.outputPath}.`);
      }

      if (options.note) {
        process.stdout.write(
          "Skipping TestFlight changelog submission because EAS restricts it to Enterprise plans.\n",
        );
      }

      const submitArgs = [
        "eas-cli",
        "submit",
        "--platform",
        "ios",
        "--profile",
        options.profile,
        "--path",
        options.outputPath,
        "--non-interactive",
        "--wait",
      ];

      for (const group of options.groups) {
        submitArgs.push("--groups", group);
      }

      await runCommand("npx", submitArgs, { cwd: mobileRoot });
    },
  );
  await recordMobileRelease({
    artifactPath: options.outputPath,
    mobileRoot,
    note: options.note,
    platform: "ios",
    profile: options.profile,
  });

  process.stdout.write(
    `iOS TestFlight release complete from local artifact ${options.outputPath}.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
