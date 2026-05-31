import { spawn } from "node:child_process";
import { parseArgs } from "node:util";

const VALID_PLATFORMS = new Set(["android", "ios", "both"]);

function printHelp() {
  process.stdout.write(
    `Usage: npm run release:mobile -- --platform <android|ios|both> [options]\n\nOptions:\n  --platform <name>              Platform to release: android, ios, or both\n  --android-note <text>          Required when releasing android\n  --android-locale <code>        Optional Android Play note locale\n  --android-track <name>         Optional Android Play track\n  --android-service-account <path> Optional Android Play service-account JSON path\n  --android-message <text>       Optional Android EAS build message\n  --android-output <path>        Optional Android local artifact path\n  --android-profile <name>       Optional Android EAS build profile\n  --ios-asc-app-id <id>          Optional App Store Connect app id override\n  --ios-api-key-id <id>          Optional App Store Connect API key ID override\n  --ios-api-issuer <id>          Optional App Store Connect API issuer ID override\n  --ios-api-key-path <path>      Optional App Store Connect API private key path override\n  --ios-api-key-subject <name>   Optional App Store Connect API key subject override\n  --ios-group <name>             Deprecated; direct iOS uploads do not auto-assign TestFlight groups\n  --ios-message <text>           Deprecated; local iOS uploads ignore EAS build messages\n  --ios-note <text>              Optional local iOS release note label\n  --ios-output <path>            Optional iOS local artifact path\n  --ios-profile <name>           Optional iOS local release trace label\n  --help                         Show this help\n`,
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

  if (options.androidLocale) {
    args.push("--locale", options.androidLocale);
  }

  if (options.androidTrack) {
    args.push("--track", options.androidTrack);
  }

  if (options.androidServiceAccount) {
    args.push("--service-account", options.androidServiceAccount);
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

  if (options.iosApiKeyId) {
    args.push("--api-key-id", options.iosApiKeyId);
  }

  if (options.iosApiIssuer) {
    args.push("--api-issuer", options.iosApiIssuer);
  }

  if (options.iosApiKeyPath) {
    args.push("--api-key-path", options.iosApiKeyPath);
  }

  if (options.iosApiKeySubject) {
    args.push("--api-key-subject", options.iosApiKeySubject);
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
      "android-locale": { type: "string" },
      "android-message": { type: "string" },
      "android-note": { type: "string" },
      "android-output": { type: "string" },
      "android-profile": { type: "string" },
      "android-service-account": { type: "string" },
      "android-track": { type: "string" },
      help: { type: "boolean" },
      "ios-asc-app-id": { type: "string" },
      "ios-api-key-id": { type: "string" },
      "ios-api-key-path": { type: "string" },
      "ios-api-key-subject": { type: "string" },
      "ios-api-issuer": { type: "string" },
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
    androidLocale: values["android-locale"]?.trim() || "",
    androidMessage: values["android-message"]?.trim() || "",
    androidNote: values["android-note"]?.trim() || "",
    androidOutput: values["android-output"]?.trim() || "",
    androidProfile: values["android-profile"]?.trim() || "",
    androidServiceAccount: values["android-service-account"]?.trim() || "",
    androidTrack: values["android-track"]?.trim() || "",
    iosAscAppId: values["ios-asc-app-id"]?.trim() || "",
    iosApiKeyId: values["ios-api-key-id"]?.trim() || "",
    iosApiKeyPath: values["ios-api-key-path"]?.trim() || "",
    iosApiKeySubject: values["ios-api-key-subject"]?.trim() || "",
    iosApiIssuer: values["ios-api-issuer"]?.trim() || "",
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
