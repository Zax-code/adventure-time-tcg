import { spawn } from "node:child_process";
import { parseArgs } from "node:util";

const VALID_PLATFORMS = new Set(["android", "ios", "both"]);

function printHelp() {
  process.stdout.write(
    `Usage: npm run build:mobile:local -- --platform <android|ios|both> [options]\n\nOptions:\n  --platform <name>         Platform to build: android, ios, or both\n  --android-message <text>  Optional Android EAS build message\n  --android-output <path>   Optional Android local artifact path\n  --android-profile <name>  Optional Android EAS build profile\n  --ios-message <text>      Optional iOS EAS build message\n  --ios-output <path>       Optional iOS local artifact path\n  --ios-profile <name>      Optional iOS EAS build profile\n  --help                    Show this help\n`,
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
  const args = ["run", "build:mobile:android:local", "--"];

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
  const args = ["run", "build:mobile:ios:local", "--"];

  if (options.iosProfile) {
    args.push("--profile", options.iosProfile);
  }

  if (options.iosMessage) {
    args.push("--message", options.iosMessage);
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
      "android-output": { type: "string" },
      "android-profile": { type: "string" },
      help: { type: "boolean" },
      "ios-message": { type: "string" },
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
    androidOutput: values["android-output"]?.trim() || "",
    androidProfile: values["android-profile"]?.trim() || "",
    iosMessage: values["ios-message"]?.trim() || "",
    iosOutput: values["ios-output"]?.trim() || "",
    iosProfile: values["ios-profile"]?.trim() || "",
  };

  const cwd = process.cwd();

  if (platform === "android" || platform === "both") {
    process.stdout.write("Starting local Android production build.\n");
    await runCommand("npm", buildAndroidArgs(options), { cwd });
  }

  if (platform === "ios" || platform === "both") {
    process.stdout.write("Starting local iOS production build.\n");
    await runCommand("npm", buildIosArgs(options), { cwd });
  }

  process.stdout.write(`Local mobile build complete for ${platform}.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
