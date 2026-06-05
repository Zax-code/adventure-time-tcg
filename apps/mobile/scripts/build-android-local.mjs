import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { parseArgs } from "node:util";

const PRODUCTION_API_BASE_URL = "https://app.leaetzak.love";
const DEFAULT_PROFILE = "production";
const DEFAULT_OUTPUT_PATH = path.resolve(
  import.meta.dirname,
  "../local-build/android-production.aab",
);

function printHelp() {
  process.stdout.write(
    `Usage: npm run build:android:local -w @adventure-time/mobile -- [options]\n\nOptions:\n  --profile <name>   EAS build profile (default: ${DEFAULT_PROFILE})\n  --message <text>   Optional EAS build message\n  --output <path>    Local .aab output path (default: ${DEFAULT_OUTPUT_PATH})\n  --help             Show this help\n`,
  );
}

function parseCliOptions() {
  const { values } = parseArgs({
    options: {
      help: { type: "boolean" },
      message: { type: "string" },
      output: { type: "string" },
      profile: { type: "string" },
    },
    allowPositionals: false,
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  return {
    message: values.message?.trim() || "",
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

async function main() {
  const mobileRoot = path.resolve(import.meta.dirname, "..");
  process.env.NODE_ENV ??= "production";
  process.env.EAS_NO_VCS ??= "1";
  process.env.EAS_BUILD_DISABLE_EXPO_DOCTOR_STEP ??= "1";
  process.env.EXPO_PUBLIC_API_BASE_URL = PRODUCTION_API_BASE_URL;

  const options = parseCliOptions();
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

  await runCommand("npx", buildArgs, { cwd: mobileRoot });

  if (!existsSync(options.outputPath)) {
    throw new Error(`Expected local Android artifact at ${options.outputPath}.`);
  }

  process.stdout.write(
    `Local Android production build complete at ${options.outputPath}.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
