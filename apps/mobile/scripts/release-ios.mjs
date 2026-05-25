import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { parseArgs } from "node:util";

const DEFAULT_PROFILE = "production";
const DEFAULT_GROUPS = [];

function printHelp() {
  process.stdout.write(`Usage: npm run release:ios -w @adventure-time/mobile -- --asc-app-id <id> [options]\n\nOptions:\n  --asc-app-id <id>         App Store Connect Apple ID for the app\n  --group <name>            Internal TestFlight group to add (repeatable)\n  --note <text>             Optional local release note label\n  --profile <name>          EAS build/submit profile (default: ${DEFAULT_PROFILE})\n  --message <text>          Optional EAS build message\n  --help                    Show this help\n`);
}

function parseCliOptions() {
  const { values } = parseArgs({
    options: {
      "asc-app-id": { type: "string" },
      group: { type: "string", multiple: true },
      help: { type: "boolean" },
      message: { type: "string" },
      note: { type: "string" },
      profile: { type: "string" },
    },
    allowPositionals: false,
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  const ascAppId =
    values["asc-app-id"]?.trim() ||
    process.env.APP_STORE_CONNECT_APP_ID?.trim() ||
    process.env.EXPO_ASC_APP_ID?.trim() ||
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
    message: values.message?.trim() || "",
    note: values.note?.trim() || "",
    profile: values.profile?.trim() || DEFAULT_PROFILE,
  };
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

function buildSubmitProfile(existingConfig, profileName, ascAppId) {
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
  const patchedConfig = buildSubmitProfile(parsedConfig, profileName, ascAppId);

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
  const mobileRoot = path.resolve(import.meta.dirname, "..");
  const buildArgs = [
    "eas-cli",
    "build",
    "--platform",
    "ios",
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

  await withTemporarySubmitProfile(
    mobileRoot,
    options.profile,
    options.ascAppId,
    async () => {
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
        "--id",
        buildId,
        "--non-interactive",
        "--wait",
      ];

      for (const group of options.groups) {
        submitArgs.push("--groups", group);
      }

      await runCommand("npx", submitArgs, { cwd: mobileRoot });
    },
  );

  process.stdout.write(`iOS TestFlight release complete for build ${buildId}.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
