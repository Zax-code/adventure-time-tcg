import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, symlinkSync } from "node:fs";
import path from "node:path";

function safeLstat(filePath) {
  try {
    return lstatSync(filePath);
  } catch {
    return null;
  }
}

function readPrimaryWorktreeRoot(workspaceRoot) {
  const output = execFileSync("git", ["worktree", "list", "--porcelain"], {
    cwd: workspaceRoot,
    encoding: "utf8",
  });

  for (const line of output.split("\n")) {
    if (line.startsWith("worktree ")) {
      return line.slice("worktree ".length).trim();
    }
  }

  return null;
}

function ensureDirectorySymlink(destinationPath, sourcePath) {
  const currentStat = safeLstat(destinationPath);

  if (currentStat) {
    return false;
  }

  if (!existsSync(sourcePath)) {
    return false;
  }

  symlinkSync(sourcePath, destinationPath, "dir");
  return true;
}

export function ensureWorktreeNodeModules({
  mobileRoot = path.resolve(import.meta.dirname, ".."),
  workspaceRoot = path.resolve(mobileRoot, "../.."),
} = {}) {
  const expoPackagePath = path.join(workspaceRoot, "node_modules/expo/package.json");

  if (existsSync(expoPackagePath)) {
    return { linked: false, primaryWorktreeRoot: workspaceRoot };
  }

  const primaryWorktreeRoot = readPrimaryWorktreeRoot(workspaceRoot);

  if (!primaryWorktreeRoot || primaryWorktreeRoot === workspaceRoot) {
    throw new Error(
      `Missing dependencies in ${workspaceRoot}. Run npm install from this checkout before running mobile commands.`,
    );
  }

  const rootLinked = ensureDirectorySymlink(
    path.join(workspaceRoot, "node_modules"),
    path.join(primaryWorktreeRoot, "node_modules"),
  );
  const mobileLinked = ensureDirectorySymlink(
    path.join(mobileRoot, "node_modules"),
    path.join(primaryWorktreeRoot, "apps/mobile/node_modules"),
  );

  if (!existsSync(expoPackagePath)) {
    throw new Error(
      `Could not resolve expo from worktree ${workspaceRoot}. Install dependencies here or in the primary worktree at ${primaryWorktreeRoot}.`,
    );
  }

  return {
    linked: rootLinked || mobileLinked,
    primaryWorktreeRoot,
  };
}

const executedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;

if (executedPath === path.resolve(import.meta.filename)) {
  const result = ensureWorktreeNodeModules();

  if (result.linked) {
    process.stdout.write(
      `Linked node_modules from primary worktree: ${result.primaryWorktreeRoot}\n`,
    );
  }
}
