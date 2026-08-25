import assert from "node:assert/strict";
import { describe, it } from "node:test";

import en from "../src/i18n/locales/en/quests.ts";
import fr from "../src/i18n/locales/fr/quests.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function collectLeafPaths(
  value: Record<string, unknown>,
  prefix = "",
): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? prefix + "." + key : key;
    if (typeof child === "string") return [path];
    if (isRecord(child)) {
      return collectLeafPaths(child, path);
    }
    return [];
  });
}

function getValueAtPath(value: Record<string, unknown>, path: string) {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!isRecord(current)) return undefined;
    return current[segment];
  }, value);
}

function collectPlaceholders(value: string) {
  return Array.from(
    value.matchAll(/\{([A-Za-z0-9_]+)\}/g),
    (match) => match[1],
  ).sort();
}

describe("quest translations", () => {
  it("keeps English and French quest key families aligned", () => {
    assert.deepEqual(collectLeafPaths(en).sort(), collectLeafPaths(fr).sort());
  });

  it("keeps interpolation placeholders aligned for every translated quest key", () => {
    for (const path of collectLeafPaths(en)) {
      const englishValue = getValueAtPath(en, path);
      const frenchValue = getValueAtPath(fr, path);

      assert.equal(
        typeof englishValue,
        "string",
        path + " must be English text",
      );
      assert.equal(typeof frenchValue, "string", path + " must be French text");
      assert.deepEqual(
        collectPlaceholders(englishValue as string),
        collectPlaceholders(frenchValue as string),
        path + " must use the same interpolation placeholders",
      );
    }
  });

  it("uses natural French copy for the Speed Calculus correct-answer ratio", () => {
    assert.equal(fr.speedCalculusShareCorrect, "Correctes");
    assert.equal(fr.speedCalculusShareErrors, "Erreurs");
    assert.equal(
      fr.speedCalculusShareSummary,
      "{correct} / {total} correctes · {accuracy}% de précision",
    );
  });
});
