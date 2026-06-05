import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { parseArgs } from "node:util";

const DEFAULT_PROFILE = "e2e-ios";
const DEFAULT_OUTPUT_PATH = path.resolve(
  import.meta.dirname,
  "../local-build/ios-e2e.tar.gz",
);

function printHelp() {
  process.stdout.write(
    `Usage: npm run build:mobile:e2e:ios -- [options]\n\nOptions:\n  --profile <name>   EAS build profile (default: ${DEFAULT_PROFILE})\n  --output <path>    Local build archive path (default: ${DEFAULT_OUTPUT_PATH})\n  --help             Show this help\n`,
  );
}

function parseCliOptions() {
  const { values } = parseArgs({
    options: {
      help: { type: "boolean" },
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
  process.env.EXPO_PUBLIC_E2E_EMAIL ??=
    process.env.MOBILE_TEST_EMAIL ?? "mobile-test@leaetzak.love";
  process.env.EXPO_PUBLIC_E2E_PASSWORD ??= process.env.MOBILE_TEST_PASSWORD ?? "";

  const options = parseCliOptions();
  await mkdir(path.dirname(options.outputPath), { recursive: true });

  await runCommand(
    "npx",
    [
      "eas-cli",
      "build",
      "--platform",
      "ios",
      "--profile",
      options.profile,
      "--local",
      "--output",
      options.outputPath,
      "--non-interactive",
    ],
    { cwd: mobileRoot },
  );

  if (!existsSync(options.outputPath)) {
    throw new Error(`Expected local iOS E2E artifact at ${options.outputPath}.`);
  }

  process.stdout.write(`Local iOS E2E build complete at ${options.outputPath}.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
