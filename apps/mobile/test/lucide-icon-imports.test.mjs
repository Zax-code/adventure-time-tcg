import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const mobileDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
// The package exports no package.json; its CommonJS entry is dist/cjs/*.js.
const lucideDir = join(dirname(require.resolve("lucide-react-native")), "../..");

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

describe("Lucide icon imports", () => {
  it("point at icon files that ship in the installed package", () => {
    // Type declarations keep renamed icons as aliases, so typecheck passes
    // while Metro cannot resolve the runtime file.
    const missing = [];

    for (const file of [
      ...sourceFiles(join(mobileDir, "app")),
      ...sourceFiles(join(mobileDir, "src")),
    ]) {
      const source = readFileSync(file, "utf8");
      for (const [, name] of source.matchAll(
        /["']lucide-react-native\/icons\/([a-z0-9-]+)["']/g,
      )) {
        if (!existsSync(join(lucideDir, "dist/esm/icons", `${name}.mjs`))) {
          missing.push(`${file.slice(mobileDir.length + 1)}: ${name}`);
        }
      }
    }

    assert.deepEqual(missing, []);
  });
});
