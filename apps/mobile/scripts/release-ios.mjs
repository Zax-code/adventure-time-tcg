import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
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
const DEFAULT_API_KEY_SUBJECT = "user";

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

function resolveApiKeyPath(apiKeyId, explicitPath) {
  const candidatePath = explicitPath?.trim() || "";

  if (candidatePath) {
    return path.resolve(candidatePath);
  }

  const searchPaths = [
    path.resolve(process.cwd(), "private_keys", `AuthKey_${apiKeyId}.p8`),
    path.resolve(process.cwd(), "private_keys", `AuthKey_${apiKeyId}.p8.txt`),
    path.join(process.env.HOME ?? "", "private_keys", `AuthKey_${apiKeyId}.p8`),
    path.join(process.env.HOME ?? "", "private_keys", `AuthKey_${apiKeyId}.p8.txt`),
    path.join(process.env.HOME ?? "", ".private_keys", `AuthKey_${apiKeyId}.p8`),
    path.join(process.env.HOME ?? "", ".private_keys", `AuthKey_${apiKeyId}.p8.txt`),
    path.join(
      process.env.HOME ?? "",
      ".appstoreconnect/private_keys",
      `AuthKey_${apiKeyId}.p8`,
    ),
    path.join(
      process.env.HOME ?? "",
      ".appstoreconnect/private_keys",
      `AuthKey_${apiKeyId}.p8.txt`,
    ),
  ];

  const existingPath = searchPaths.find((candidate) => existsSync(candidate));
  return existingPath || "";
}

function printHelp() {
  process.stdout.write(
    `Usage: npm run release:ios -w @adventure-time/mobile -- --asc-app-id <id> [options]\n\nOptions:\n  --asc-app-id <id>         App Store Connect Apple ID for the app\n  --api-key-id <id>         App Store Connect API key ID\n  --api-issuer <id>         App Store Connect API issuer ID\n  --api-key-path <path>     App Store Connect API private key path (.p8)\n  --api-key-subject <name>  API key subject (default: ${DEFAULT_API_KEY_SUBJECT})\n  --group <name>            Deprecated; direct uploads do not auto-assign TestFlight groups\n  --message <text>          Deprecated; local iOS uploads ignore EAS build messages\n  --note <text>             Optional local release note label\n  --profile <name>          Optional local release trace label (default: ${DEFAULT_PROFILE})\n  --output <path>           Local .ipa output path (default: ${DEFAULT_OUTPUT_PATH})\n  --help                    Show this help\n`,
  );
}

async function parseCliOptions(mobileRoot) {
  const { values } = parseArgs({
    options: {
      "asc-app-id": { type: "string" },
      "api-key-id": { type: "string" },
      "api-key-path": { type: "string" },
      "api-key-subject": { type: "string" },
      "api-issuer": { type: "string" },
      group: { type: "string", multiple: true },
      help: { type: "boolean" },
      message: { type: "string" },
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
  const localApiKeyId = await readLocalEnvValue(
    mobileRoot,
    "APP_STORE_CONNECT_API_KEY_ID",
  );
  const localApiIssuer = await readLocalEnvValue(
    mobileRoot,
    "APP_STORE_CONNECT_API_ISSUER_ID",
  );
  const localApiKeyPath = await readLocalEnvValue(
    mobileRoot,
    "APP_STORE_CONNECT_API_KEY_PATH",
  );
  const localApiKeySubject = await readLocalEnvValue(
    mobileRoot,
    "APP_STORE_CONNECT_API_KEY_SUBJECT",
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

  const apiKeyId =
    values["api-key-id"]?.trim() ||
    process.env.APP_STORE_CONNECT_API_KEY_ID?.trim() ||
    localApiKeyId ||
    "";

  if (!apiKeyId) {
    throw new Error(
      "Missing App Store Connect API key id. Pass --api-key-id or set APP_STORE_CONNECT_API_KEY_ID.",
    );
  }

  const apiIssuer =
    values["api-issuer"]?.trim() ||
    process.env.APP_STORE_CONNECT_API_ISSUER_ID?.trim() ||
    localApiIssuer ||
    "";

  if (!apiIssuer) {
    throw new Error(
      "Missing App Store Connect API issuer id. Pass --api-issuer or set APP_STORE_CONNECT_API_ISSUER_ID.",
    );
  }

  const apiKeyPath = resolveApiKeyPath(
    apiKeyId,
    values["api-key-path"]?.trim() ||
      process.env.APP_STORE_CONNECT_API_KEY_PATH?.trim() ||
      localApiKeyPath,
  );

  if (!apiKeyPath || !existsSync(apiKeyPath)) {
    throw new Error(
      `Missing App Store Connect API private key. Pass --api-key-path or set APP_STORE_CONNECT_API_KEY_PATH. Looked for AuthKey_${apiKeyId}.p8 in the standard Apple private-key directories.`,
    );
  }

  return {
    ascAppId,
    apiKeyId,
    apiKeyPath,
    apiKeySubject:
      values["api-key-subject"]?.trim() ||
      process.env.APP_STORE_CONNECT_API_KEY_SUBJECT?.trim() ||
      localApiKeySubject ||
      DEFAULT_API_KEY_SUBJECT,
    apiIssuer,
    groups: (values.group ?? DEFAULT_GROUPS)
      .map((group) => group.trim())
      .filter(Boolean),
    message: values.message?.trim() || "",
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

async function readPlistValue(plistPath, key) {
  return runCommand("/usr/libexec/PlistBuddy", ["-c", `Print :${key}`, plistPath], {
    cwd: path.dirname(plistPath),
  });
}

async function main() {
  const mobileRoot = path.resolve(import.meta.dirname, "..");
  process.env.NODE_ENV ??= "production";
  process.env.EAS_NO_VCS ??= "1";
  process.env.EAS_BUILD_DISABLE_EXPO_DOCTOR_STEP ??= "1";

  const options = await parseCliOptions(mobileRoot);
  await mkdir(path.dirname(options.outputPath), { recursive: true });
  const infoPlistPath = path.join(
    mobileRoot,
    "ios/AdventureTimeNative/Info.plist",
  );

  await buildIosLocally({
    mobileRoot,
    outputPath: options.outputPath,
  });

  if (!existsSync(options.outputPath)) {
    throw new Error(`Expected local iOS artifact at ${options.outputPath}.`);
  }

  if (options.message) {
    process.stdout.write(
      "Ignoring deprecated --message; local iOS uploads do not use EAS build messages.\n",
    );
  }

  if (options.groups.length > 0) {
    process.stdout.write(
      "Ignoring deprecated --group values; direct App Store uploads do not auto-assign TestFlight groups.\n",
    );
  }

  const [bundleShortVersionString, bundleVersion] = await Promise.all([
    readPlistValue(infoPlistPath, "CFBundleShortVersionString"),
    readPlistValue(infoPlistPath, "CFBundleVersion"),
  ]);

  const uploadArgs = [
    "altool",
    "--upload-package",
    options.outputPath,
    "--platform",
    "ios",
    "--apple-id",
    options.ascAppId,
    "--bundle-version",
    bundleVersion.trim(),
    "--bundle-short-version-string",
    bundleShortVersionString.trim(),
    "--api-key",
    options.apiKeyId,
    "--api-issuer",
    options.apiIssuer,
    "--p8-file-path",
    options.apiKeyPath,
    "--wait",
    "--output-format",
    "json",
    "--show-progress",
  ];

  if (options.apiKeySubject) {
    uploadArgs.push("--api-key-subject", options.apiKeySubject);
  }

  await runCommand("xcrun", uploadArgs, { cwd: mobileRoot });

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
