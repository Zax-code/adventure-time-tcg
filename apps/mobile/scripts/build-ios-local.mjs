import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { buildIosLocally } from "./ios-local-build.mjs";

const PRODUCTION_API_BASE_URL = "https://app.leaetzak.love";

const DEFAULT_OUTPUT_PATH = path.resolve(
  import.meta.dirname,
  "../local-build/ios-production.ipa",
);

function printHelp() {
  process.stdout.write(
    `Usage: npm run build:ios:local -w @adventure-time/mobile -- [options]\n\nOptions:\n  --output <path>    Local .ipa output path (default: ${DEFAULT_OUTPUT_PATH})\n  --help             Show this help\n`,
  );
}

function parseCliOptions() {
  const { values } = parseArgs({
    options: {
      help: { type: "boolean" },
      output: { type: "string" },
    },
    allowPositionals: false,
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  return {
    outputPath: values.output?.trim() || DEFAULT_OUTPUT_PATH,
  };
}

async function main() {
  const mobileRoot = path.resolve(import.meta.dirname, "..");
  process.env.NODE_ENV ??= "production";
  process.env.EXPO_PUBLIC_API_BASE_URL = PRODUCTION_API_BASE_URL;

  const options = parseCliOptions();
  await mkdir(path.dirname(options.outputPath), { recursive: true });
  await buildIosLocally({
    mobileRoot,
    outputPath: options.outputPath,
  });

  if (!existsSync(options.outputPath)) {
    throw new Error(`Expected local iOS artifact at ${options.outputPath}.`);
  }

  process.stdout.write(
    `Local iOS production build complete at ${options.outputPath}.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
