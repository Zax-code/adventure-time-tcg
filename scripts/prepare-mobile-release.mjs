import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { spawnSync } from "node:child_process";

const VALID_PLATFORMS = new Set(["android", "ios", "both"]);
const MOBILE_RELEASE_PATHS = [
  "apps/mobile",
  "packages/api-client",
  "packages/contracts",
  "packages/game-engine",
];

function printHelp() {
  process.stdout.write(
    "Usage: node ./scripts/prepare-mobile-release.mjs --platform <android|ios|both> [--ref <git-ref>] [--output-dir <path>]\n",
  );
}

function runGit(args) {
  const result = spawnSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed with exit code ${result.status}: ${result.stderr.trim()}`,
    );
  }

  return result.stdout.trim();
}

function normalizePlatform(platform) {
  if (!VALID_PLATFORMS.has(platform)) {
    throw new Error(
      "Missing or invalid --platform. Use android, ios, or both.",
    );
  }

  return platform;
}

function resolvePlatforms(platform) {
  if (platform === "both") {
    return ["android", "ios"];
  }

  return [platform];
}

function getLatestPlatformTag(platform) {
  const output = runGit([
    "tag",
    "--list",
    `mobile/${platform}/*`,
    "--sort=-creatordate",
  ]);

  return output.split("\n").map((line) => line.trim()).filter(Boolean)[0] || "";
}

function getCommitLines(baseTag, ref) {
  const range = baseTag ? `${baseTag}..${ref}` : ref;
  const output = runGit([
    "log",
    "--no-merges",
    "--pretty=format:%h%x09%s",
    range,
    "--",
    ...MOBILE_RELEASE_PATHS,
  ]);

  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [sha, ...subjectParts] = line.split("\t");

      return {
        sha,
        subject: subjectParts.join("\t").trim(),
      };
    });
}

function summarizeForStore(commits, platform) {
  const notableSubjects = commits
    .map((commit) => commit.subject)
    .filter(Boolean)
    .slice(0, 3);

  if (notableSubjects.length === 0) {
    return platform === "android"
      ? "Maintenance release with stability improvements."
      : "Maintenance release";
  }

  const note = notableSubjects.join("; ");
  const normalized = note.replace(/\.$/, "");
  const maxLength = platform === "android" ? 450 : 200;

  return normalized.slice(0, maxLength);
}

function buildPlatformSection({ baseTag, commits, note, platform, ref }) {
  const title = platform === "android" ? "Android" : "iOS";
  const compareBase = baseTag || "first release";
  const command =
    platform === "android"
      ? `npm run release:mobile -- --platform android --android-note "${note}"`
      : `npm run release:mobile -- --platform ios --ios-note "${note}"`;
  const lines = [
    `## ${title}`,
    "",
    `- Target ref: \`${ref}\``,
    `- Baseline tag: \`${compareBase}\``,
    `- Commit count: ${commits.length}`,
    `- Suggested store note: ${note}`,
    `- Local release command: \`${command}\``,
    "",
    "### Included commits",
    "",
  ];

  if (commits.length === 0) {
    lines.push("- No mobile-scoped commits found since the last platform release tag.");
    lines.push("");
    return lines.join("\n");
  }

  for (const commit of commits) {
    lines.push(`- \`${commit.sha}\` ${commit.subject}`);
  }

  lines.push("");
  return lines.join("\n");
}

async function main() {
  const { values } = parseArgs({
    options: {
      help: { type: "boolean" },
      "output-dir": { type: "string" },
      platform: { type: "string" },
      ref: { type: "string" },
    },
  });

  if (values.help) {
    printHelp();
    return;
  }

  const platform = normalizePlatform((values.platform || "").trim().toLowerCase());
  const ref = (values.ref || "HEAD").trim();
  const outputDir = path.resolve(
    process.cwd(),
    values["output-dir"]?.trim() || ".release",
  );

  runGit(["rev-parse", "--verify", `${ref}^{commit}`]);
  await mkdir(outputDir, { recursive: true });

  const markdownSections = ["# Mobile Release Plan", ""];

  for (const currentPlatform of resolvePlatforms(platform)) {
    const baseTag = getLatestPlatformTag(currentPlatform);
    const commits = getCommitLines(baseTag, ref);
    const note = summarizeForStore(commits, currentPlatform);
    const notePath = path.join(outputDir, `${currentPlatform}-note.txt`);
    const detailPath = path.join(outputDir, `${currentPlatform}-commits.json`);

    await writeFile(notePath, `${note}\n`, "utf8");
    await writeFile(
      detailPath,
      `${JSON.stringify(
        {
          baseTag: baseTag || null,
          commits,
          platform: currentPlatform,
          ref,
          suggestedNote: note,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    markdownSections.push(
      buildPlatformSection({
        baseTag,
        commits,
        note,
        platform: currentPlatform,
        ref,
      }),
    );
  }

  const planPath = path.join(outputDir, "mobile-release-plan.md");
  await writeFile(planPath, `${markdownSections.join("\n")}\n`, "utf8");
  process.stdout.write(`Wrote mobile release plan to ${planPath}.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
