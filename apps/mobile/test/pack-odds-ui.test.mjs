import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { formatBaseRarityPercentage } from "../src/features/packs/pack-odds-format.ts";

const packsScreenSource = readFileSync("app/(tabs)/packs.tsx", "utf8");
const oddsSheetSource = readFileSync(
  "src/features/packs/pack-odds-sheet.tsx",
  "utf8",
);
const englishSource = readFileSync("src/i18n/locales/en/packs.ts", "utf8");
const frenchSource = readFileSync("src/i18n/locales/fr/packs.ts", "utf8");

describe("pack odds storefront", () => {
  it("does not round tiny or near-certain chances to impossible or certain", () => {
    assert.equal(formatBaseRarityPercentage(0, "en"), "0%");
    assert.equal(formatBaseRarityPercentage(0.004, "en"), "<0.01%");
    assert.equal(formatBaseRarityPercentage(12.345, "en"), "12.35%");
    assert.equal(formatBaseRarityPercentage(99.996, "en"), ">99.99%");
    assert.equal(formatBaseRarityPercentage(100, "en"), "100%");

    const frenchThreshold = new Intl.NumberFormat("fr", {
      style: "percent",
      maximumFractionDigits: 2,
    }).format(0.0001);
    assert.equal(
      formatBaseRarityPercentage(0.004, "fr"),
      `<${frenchThreshold}`,
    );
  });

  it("keeps odds available outside disabled purchase controls", () => {
    const packCardSource = packsScreenSource.slice(
      packsScreenSource.indexOf("{packs.map((pack) =>"),
      packsScreenSource.indexOf(
        "<View style={{ height: storefrontScrollBottomSpacerHeight }} />",
      ),
    );

    assert.match(packCardSource, /testID=\{`pack-card-\$\{slug\}`\}/);
    assert.match(packCardSource, /disabled=\{isOpening \|\| !canOpen\}/);
    assert.match(packCardSource, /testID=\{`pack-odds-button-\$\{slug\}`\}/);
    assert.match(packCardSource, /onPress=\{\(\) => setOddsPack\(pack\)\}/);
    assert.ok(
      packCardSource.indexOf("pack-odds-button-${slug}") >
        packCardSource.indexOf("</Pressable>"),
      "the odds action must be a sibling after the purchase Pressable",
    );
  });

  it("renders only the server-authored distribution and its edge states", () => {
    assert.match(
      oddsSheetSource,
      /odds\.baseRarityPercentages\.map\(\(row\) =>/,
    );
    assert.match(oddsSheetSource, /odds\.randomSlotCount > 0/);
    assert.match(oddsSheetSource, /pack-odds-unavailable/);
    assert.doesNotMatch(
      oddsSheetSource,
      /\{ rarity: ["'](?:Common|Uncommon|Rare|Epic|Legendary)["'], percentage:/,
      "the UI must not contain a fallback rarity distribution",
    );
  });

  it("keeps canonical rarity labels localized and EN/FR odds copy aligned", () => {
    assert.match(oddsSheetSource, /localizeRarityName\(row\.rarity, t\)/);
    assert.match(
      oddsSheetSource,
      /localizeRarityName\(odds\.guaranteedRarity, t\)/,
    );

    const keys = [
      "title",
      "view",
      "slotsTitle",
      "guaranteedBody",
      "noGuaranteedBody",
      "randomBody",
      "noRandomBody",
      "distributionTitle",
      "distributionSubtitle",
      "independentDraws",
      "distributionUnavailable",
      "availabilityTitle",
      "weeklyLimitCount",
      "weeklyRemaining",
    ];
    for (const key of keys) {
      assert.match(englishSource, new RegExp(`\\b${key}:`));
      assert.match(frenchSource, new RegExp(`\\b${key}:`));
    }
  });
});
