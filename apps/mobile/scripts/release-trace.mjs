import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

function runCommand(command, args, { cwd }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ["inherit", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }

      const error = new Error(
        `${command} ${args.join(" ")} failed with exit code ${code}${stderr ? `: ${stderr.trim()}` : ""}`,
      );
      error.code = code;
      reject(error);
    });
  });
}

function runGit(args, options) {
  return runCommand("git", args, options);
}

async function readMobileVersion(mobileRoot) {
  const packageJsonPath = path.join(mobileRoot, "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  const version = packageJson.version?.trim();

  if (!version) {
    throw new Error(`Missing version in ${packageJsonPath}.`);
  }

  return version;
}

function normalizePlatform(platform) {
  if (platform === "android" || platform === "ios") {
    return platform;
  }

  throw new Error(`Unsupported mobile release platform "${platform}".`);
}

function buildTagName(platform, version, buildNumber) {
  return buildNumber
    ? `mobile/${platform}/${version}+${buildNumber}`
    : `mobile/${platform}/${version}`;
}

function buildTagMessage({
  artifactPath,
  buildNumber,
  commitSha,
  note,
  platform,
  profile,
  releasedAt,
  version,
}) {
  const releaseLabel = buildNumber ? `${version}+${buildNumber}` : version;
  const lines = [
    `Adventure Time mobile ${platform} release ${releaseLabel}`,
    "",
    `commit: ${commitSha}`,
    `released-at: ${releasedAt}`,
    `profile: ${profile}`,
    `artifact: ${artifactPath}`,
  ];

  if (note) {
    lines.push(`note: ${note}`);
  }

  return lines.join("\n");
}

function buildBackfillTagMessage({
  buildId,
  buildNumber,
  commitSha,
  completedAt,
  platform,
  version,
}) {
  const releaseLabel = buildNumber ? `${version}+${buildNumber}` : version;

  return [
    `Backfilled Adventure Time mobile ${platform} release ${releaseLabel}`,
    "",
    `commit: ${commitSha}`,
    `completed-at: ${completedAt}`,
    `source: eas build ${buildId}`,
  ].join("\n");
}

async function listPlatformTags(repoRoot, platform) {
  const output = await runGit(
    ["tag", "--list", `mobile/${platform}/*`, "--sort=-creatordate"],
    { cwd: repoRoot },
  );

  return output
    ? output
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    : [];
}

async function readTaggedCommit(repoRoot, tagName) {
  return runGit(["rev-list", "-n", "1", tagName], { cwd: repoRoot });
}

async function createAnnotatedTag(repoRoot, { commitSha, message, tagName }) {
  let existingCommit = "";

  try {
    existingCommit = await readTaggedCommit(repoRoot, tagName);
  } catch (error) {
    if (error.code !== 128) {
      throw error;
    }
  }

  if (existingCommit) {
    if (existingCommit === commitSha) {
      return false;
    }

    throw new Error(
      `Release tag ${tagName} already exists at ${existingCommit}, not target commit ${commitSha}.`,
    );
  }

  await runGit(["tag", "-a", tagName, commitSha, "-m", message], {
    cwd: repoRoot,
  });

  return true;
}

async function fetchLatestFinishedStoreBuild({ mobileRoot, platform }) {
  const easPlatform = normalizePlatform(platform);
  const output = await runCommand(
    "npx",
    [
      "eas-cli",
      "build:list",
      "--platform",
      easPlatform,
      "--distribution",
      "store",
      "--limit",
      "10",
      "--json",
      "--non-interactive",
    ],
    { cwd: mobileRoot },
  );
  const builds = JSON.parse(output);

  if (!Array.isArray(builds)) {
    throw new Error("Unexpected EAS build history response.");
  }

  const latestBuild = builds.find((build) => build?.status === "FINISHED");
  if (!latestBuild) {
    return null;
  }

  return latestBuild;
}

export async function ensureReleaseTraceBaselineFromEas({
  mobileRoot,
  platform,
}) {
  const normalizedPlatform = normalizePlatform(platform);
  const repoRoot = path.resolve(mobileRoot, "..", "..");
  const existingTags = await listPlatformTags(repoRoot, normalizedPlatform);

  if (existingTags.length > 0) {
    return { created: false, reason: "existing-tag", tagName: existingTags[0] };
  }

  const latestBuild = await fetchLatestFinishedStoreBuild({
    mobileRoot,
    platform: normalizedPlatform,
  });

  if (!latestBuild?.gitCommitHash || !latestBuild?.appVersion) {
    process.stdout.write(
      `No finished EAS store build with commit metadata was found to backfill ${normalizedPlatform} release trace.\n`,
    );

    return { created: false, reason: "no-build" };
  }

  const buildNumber =
    normalizedPlatform === "android"
      ? latestBuild.appBuildVersion?.trim?.() || ""
      : "";
  const tagName = buildTagName(
    normalizedPlatform,
    latestBuild.appVersion.trim(),
    buildNumber,
  );
  const created = await createAnnotatedTag(repoRoot, {
    commitSha: latestBuild.gitCommitHash.trim(),
    message: buildBackfillTagMessage({
      buildId: latestBuild.id,
      buildNumber,
      commitSha: latestBuild.gitCommitHash.trim(),
      completedAt:
        latestBuild.completedAt ??
        latestBuild.updatedAt ??
        latestBuild.createdAt,
      platform: normalizedPlatform,
      version: latestBuild.appVersion.trim(),
    }),
    tagName,
  });

  process.stdout.write(
    `Backfilled ${normalizedPlatform} release trace from EAS build ${latestBuild.id} into git tag ${tagName} (${latestBuild.gitCommitHash.trim()}). Push tags to share it with other clones.\n`,
  );

  return {
    buildId: latestBuild.id,
    commitSha: latestBuild.gitCommitHash.trim(),
    created,
    reason: "backfilled",
    tagName,
  };
}

export async function recordMobileRelease({
  artifactPath,
  buildNumber = "",
  mobileRoot,
  note = "",
  platform,
  profile,
}) {
  const normalizedPlatform = normalizePlatform(platform);
  const repoRoot = path.resolve(mobileRoot, "..", "..");

  await ensureReleaseTraceBaselineFromEas({
    mobileRoot,
    platform: normalizedPlatform,
  });

  const commitSha = await runGit(["rev-parse", "HEAD"], { cwd: repoRoot });
  const version = await readMobileVersion(mobileRoot);
  const tagName = buildTagName(normalizedPlatform, version, buildNumber);
  const releasedAt = new Date().toISOString();
  const tagMessage = buildTagMessage({
    artifactPath,
    buildNumber,
    commitSha,
    note,
    platform: normalizedPlatform,
    profile,
    releasedAt,
    version,
  });
  const created = await createAnnotatedTag(repoRoot, {
    commitSha,
    message: tagMessage,
    tagName,
  });

  if (!created) {
    process.stdout.write(
      `Release trace already exists for ${normalizedPlatform} at ${tagName} (${commitSha}).\n`,
    );

    return { commitSha, created: false, tagName, version };
  }

  process.stdout.write(
    `Recorded ${normalizedPlatform} release trace in git tag ${tagName} (${commitSha}). Push tags to share it with other clones.\n`,
  );

  return { commitSha, created: true, tagName, version };
}
