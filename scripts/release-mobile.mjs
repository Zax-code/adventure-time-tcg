import { spawn } from "node:child_process";
import { parseArgs } from "node:util";

const VALID_PLATFORMS = new Set(["android", "ios", "both"]);

function printHelp() {
  process.stdout.write(
    `Usage: npm run release:mobile -- --platform <android|ios|both> [options]\n\nOptions:\n  --platform <name>         Platform to release: android, ios, or both\n  --android-note <text>     Required when releasing android\n  --android-message <text>  Optional Android EAS build message\n  --android-output <path>   Optional Android local artifact path\n  --android-profile <name>  Optional Android EAS build profile\n  --ios-asc-app-id <id>     Optional App Store Connect app id override\n  --ios-group <name>        Optional TestFlight group (repeatable)\n  --ios-message <text>      Optional iOS EAS build message\n  --ios-note <text>         Optional local iOS release note label\n  --ios-output <path>       Optional iOS local artifact path\n  --ios-profile <name>      Optional iOS EAS build profile\n  --help                    Show this help\n`,
  );
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

function buildAndroidArgs(options) {
  if (!options.androidNote) {
    throw new Error(
      "Missing --android-note. Android releases require a short release note.",
    );
  }

  const args = [
    "run",
    "release:mobile:android",
    "--",
    "--note",
    options.androidNote,
  ];

  if (options.androidProfile) {
    args.push("--profile", options.androidProfile);
  }

  if (options.androidMessage) {
    args.push("--message", options.androidMessage);
  }

  if (options.androidOutput) {
    args.push("--output", options.androidOutput);
  }

  return args;
}

function buildIosArgs(options) {
  const args = ["run", "release:mobile:ios", "--"];

  if (options.iosAscAppId) {
    args.push("--asc-app-id", options.iosAscAppId);
  }

  for (const group of options.iosGroups) {
    args.push("--group", group);
  }

  if (options.iosProfile) {
    args.push("--profile", options.iosProfile);
  }

  if (options.iosMessage) {
    args.push("--message", options.iosMessage);
  }

  if (options.iosNote) {
    args.push("--note", options.iosNote);
  }

  if (options.iosOutput) {
    args.push("--output", options.iosOutput);
  }

  return args;
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      "android-message": { type: "string" },
      "android-note": { type: "string" },
      "android-output": { type: "string" },
      "android-profile": { type: "string" },
      help: { type: "boolean" },
      "ios-asc-app-id": { type: "string" },
      "ios-group": { type: "string", multiple: true },
      "ios-message": { type: "string" },
      "ios-note": { type: "string" },
      "ios-output": { type: "string" },
      "ios-profile": { type: "string" },
      platform: { type: "string" },
    },
  });

  if (values.help) {
    printHelp();
    return;
  }

  const platform = (values.platform ?? positionals[0] ?? "").trim().toLowerCase();
  if (!VALID_PLATFORMS.has(platform)) {
    throw new Error(
      "Missing or invalid platform. Use --platform android, ios, or both.",
    );
  }

  const options = {
    androidMessage: values["android-message"]?.trim() || "",
    androidNote: values["android-note"]?.trim() || "",
    androidOutput: values["android-output"]?.trim() || "",
    androidProfile: values["android-profile"]?.trim() || "",
    iosAscAppId: values["ios-asc-app-id"]?.trim() || "",
    iosGroups: (values["ios-group"] ?? [])
      .map((group) => group.trim())
      .filter(Boolean),
    iosMessage: values["ios-message"]?.trim() || "",
    iosNote: values["ios-note"]?.trim() || "",
    iosOutput: values["ios-output"]?.trim() || "",
    iosProfile: values["ios-profile"]?.trim() || "",
  };

  const cwd = process.cwd();

  if (platform === "android" || platform === "both") {
    process.stdout.write("Starting Android production release.\n");
    await runCommand("npm", buildAndroidArgs(options), { cwd });
  }

  if (platform === "ios" || platform === "both") {
    process.stdout.write("Starting iOS production release.\n");
    await runCommand("npm", buildIosArgs(options), { cwd });
  }

  process.stdout.write(`Mobile production release complete for ${platform}.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
