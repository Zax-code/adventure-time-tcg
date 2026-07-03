import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync("app/(tabs)/packs.tsx", "utf8");

describe("Pack tab scroll insets", () => {
  it("keeps bottom tab clearance in ScrollView content padding for Android", () => {
    const scrollViews = source.match(/<ScrollView[\s\S]*?<\/ScrollView>/g) ?? [];
    const packScrollViews = scrollViews.filter((block) =>
      block.includes("bottomTabPadding"),
    );

    assert.match(
      source,
      /const storefrontScrollBottomSpacerHeight = bottomTabPadding;/,
    );
    assert.match(
      source,
      /const summaryScrollBottomSpacerHeight = Math\.max\(92, bottomTabPadding\);/,
    );
    assert.ok(
      packScrollViews.length >= 2,
      "Expected the pack storefront and summary ScrollViews to use bottom tab padding.",
    );

    assert.ok(
      packScrollViews.some((block) =>
        block.includes("height: storefrontScrollBottomSpacerHeight"),
      ),
      "The pack storefront ScrollView must include scrollable bottom spacer content for Android.",
    );
    assert.ok(
      packScrollViews.some((block) =>
        block.includes("height: summaryScrollBottomSpacerHeight"),
      ),
      "The pack summary ScrollView must include scrollable bottom spacer content for Android.",
    );

    for (const block of packScrollViews) {
      assert.doesNotMatch(
        block,
        /contentInset=\{\{\s*bottom:\s*bottomTabPadding\s*\}\}/,
        "Do not rely on contentInset for pack tab bottom clearance; Android can leave the last pack behind the tab bar.",
      );
    }
  });
});
