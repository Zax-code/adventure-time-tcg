import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const IOS_WORKSPACE = "AdventureTimeNative.xcworkspace";
const IOS_SCHEME = "AdventureTimeNative";
const IOS_CONFIGURATION = "Release";
const IOS_DESTINATION = "generic/platform=iOS";
const LOGIN_KEYCHAIN_PATH = path.join(
  os.homedir(),
  "Library/Keychains/login.keychain-db",
);

function runCommand(command, args, { cwd, stdio = "pipe" } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio,
    });

    let stdout = "";
    let stderr = "";

    if (stdio === "pipe") {
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }

      const detail =
        stdio === "pipe" && stderr.trim() ? `: ${stderr.trim()}` : "";
      reject(
        new Error(
          `Command failed with exit code ${code}: ${command} ${args.join(" ")}${detail}`,
        ),
      );
    });
  });
}

async function shell(command, { cwd } = {}) {
  return runCommand("zsh", ["-lc", command], { cwd });
}

async function readCredentials(mobileRoot) {
  const credentialsPath = path.join(mobileRoot, "credentials.json");
  const credentials = JSON.parse(await readFile(credentialsPath, "utf8"));
  const mainTarget = credentials?.ios?.AdventureTimeNative;
  const widgetTarget = credentials?.ios?.StepQuestWidgetExtension;

  if (!mainTarget || !widgetTarget) {
    throw new Error(
      `Missing iOS local credentials in ${credentialsPath}. Expected AdventureTimeNative and StepQuestWidgetExtension entries.`,
    );
  }

  return {
    mainTarget: {
      certPassword: mainTarget.distributionCertificate?.password ?? "",
      certPath: path.resolve(mobileRoot, mainTarget.distributionCertificate?.path ?? ""),
      profilePath: path.resolve(mobileRoot, mainTarget.provisioningProfilePath ?? ""),
    },
    widgetTarget: {
      certPassword: widgetTarget.distributionCertificate?.password ?? "",
      certPath: path.resolve(mobileRoot, widgetTarget.distributionCertificate?.path ?? ""),
      profilePath: path.resolve(mobileRoot, widgetTarget.provisioningProfilePath ?? ""),
    },
  };
}

async function readProfileField(profilePath, keyPath) {
  const quotedProfile = profilePath.replace(/'/g, "'\\''");
  const quotedKey = keyPath.replace(/'/g, "'\\''");

  return shell(
    `security cms -D -i '${quotedProfile}' | plutil -extract '${quotedKey}' raw -`,
  );
}

function stripTeamPrefix(applicationIdentifier) {
  const firstDotIndex = applicationIdentifier.indexOf(".");

  if (firstDotIndex < 0) {
    throw new Error(
      `Unexpected application identifier "${applicationIdentifier}" in provisioning profile.`,
    );
  }

  return applicationIdentifier.slice(firstDotIndex + 1);
}

async function readProvisioningProfile(profilePath) {
  const [uuid, applicationIdentifier] = await Promise.all([
    readProfileField(profilePath, "UUID"),
    readProfileField(profilePath, "Entitlements.application-identifier"),
  ]);

  return {
    bundleIdentifier: stripTeamPrefix(applicationIdentifier),
    path: profilePath,
    uuid,
  };
}

async function installProvisioningProfile(profile) {
  const destinationDir = path.join(
    os.homedir(),
    "Library/MobileDevice/Provisioning Profiles",
  );
  const destinationPath = path.join(destinationDir, `${profile.uuid}.mobileprovision`);

  await runCommand("mkdir", ["-p", destinationDir]);
  await cp(profile.path, destinationPath);

  return destinationPath;
}

async function readCertificateSha1(certPath, certPassword) {
  const quotedPath = certPath.replace(/'/g, "'\\''");
  const quotedPassword = certPassword.replace(/'/g, "'\\''");
  const fingerprint = await shell(
    `openssl pkcs12 -in '${quotedPath}' -clcerts -nokeys -passin pass:'${quotedPassword}' | openssl x509 -noout -fingerprint -sha1 | cut -d= -f2`,
  );

  return fingerprint.replace(/:/g, "").trim().toUpperCase();
}

async function ensureSigningIdentityAvailable(certificateSha1) {
  const identities = await runCommand(
    "security",
    ["find-identity", "-v", "-p", "codesigning", LOGIN_KEYCHAIN_PATH],
    {},
  );

  if (identities.toUpperCase().includes(certificateSha1)) {
    return;
  }

  throw new Error(
    `Signing identity ${certificateSha1} is not available in ${LOGIN_KEYCHAIN_PATH}. Import the matching distribution certificate into the login keychain before running a local iOS release.`,
  );
}

async function writeExportOptionsPlist(exportOptionsPath, profiles, certificateSha1) {
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>destination</key>
  <string>export</string>
  <key>method</key>
  <string>app-store-connect</string>
  <key>provisioningProfiles</key>
  <dict>
    <key>${profiles.main.bundleIdentifier}</key>
    <string>${profiles.main.uuid}</string>
    <key>${profiles.widget.bundleIdentifier}</key>
    <string>${profiles.widget.uuid}</string>
  </dict>
  <key>signingCertificate</key>
  <string>${certificateSha1}</string>
  <key>signingStyle</key>
  <string>manual</string>
  <key>stripSwiftSymbols</key>
  <true/>
  <key>teamID</key>
  <string>${profiles.teamId}</string>
  <key>uploadSymbols</key>
  <true/>
</dict>
</plist>
`;

  await writeFile(exportOptionsPath, plist, "utf8");
}

export async function buildIosLocally({
  mobileRoot,
  outputPath,
}) {
  const credentials = await readCredentials(mobileRoot);
  const [mainProfile, widgetProfile, certificateSha1] = await Promise.all([
    readProvisioningProfile(credentials.mainTarget.profilePath),
    readProvisioningProfile(credentials.widgetTarget.profilePath),
    readCertificateSha1(
      credentials.mainTarget.certPath,
      credentials.mainTarget.certPassword,
    ),
  ]);

  await ensureSigningIdentityAvailable(certificateSha1);
  await Promise.all([
    installProvisioningProfile(mainProfile),
    installProvisioningProfile(widgetProfile),
  ]);

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "adventure-time-ios-build-"));
  const iosRoot = path.join(mobileRoot, "ios");
  const derivedDataPath = path.join(tempRoot, "DerivedData");
  const archivePath = path.join(tempRoot, "AdventureTimeNative.xcarchive");
  const exportPath = path.join(tempRoot, "export");
  const exportOptionsPath = path.join(tempRoot, "ExportOptions.plist");

  try {
    await writeExportOptionsPlist(
      exportOptionsPath,
      {
        main: mainProfile,
        teamId: "MDPYMBZQ36",
        widget: widgetProfile,
      },
      certificateSha1,
    );

    await runCommand(
      "xcodebuild",
      [
        "-workspace",
        IOS_WORKSPACE,
        "-scheme",
        IOS_SCHEME,
        "-configuration",
        IOS_CONFIGURATION,
        "-derivedDataPath",
        derivedDataPath,
        "-destination",
        IOS_DESTINATION,
        "-archivePath",
        archivePath,
        "CODE_SIGNING_ALLOWED=NO",
        "archive",
      ],
      {
        cwd: iosRoot,
        stdio: "inherit",
      },
    );

    await runCommand(
      "xcodebuild",
      [
        "-exportArchive",
        "-archivePath",
        archivePath,
        "-exportPath",
        exportPath,
        "-exportOptionsPlist",
        exportOptionsPath,
      ],
      {
        cwd: iosRoot,
        stdio: "inherit",
      },
    );

    const exportedIpaPath = path.join(exportPath, "AdventureTimeNative.ipa");
    await cp(exportedIpaPath, outputPath);

    return outputPath;
  } finally {
    await rm(tempRoot, { force: true, recursive: true });
  }
}
