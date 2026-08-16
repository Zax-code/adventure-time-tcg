import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const hudSource = readFileSync(
  "src/features/quests/speed-calculus/hud-card.tsx",
  "utf8",
);
const questHubSource = readFileSync(
  "src/features/quests/quest-hub-components.tsx",
  "utf8",
);
const questsScreenSource = readFileSync("app/(tabs)/quests.tsx", "utf8");
const collectionSource = readFileSync("app/(tabs)/collection.tsx", "utf8");
const appHeaderSource = readFileSync("src/components/app-header.tsx", "utf8");
const rankingsSource = readFileSync(
  "src/features/leaderboards/rankings-screen.tsx",
  "utf8",
);
const frenchRankingsSource = readFileSync(
  "src/i18n/locales/fr/rankings.ts",
  "utf8",
);
const loadingStateSource = readFileSync(
  "src/components/loading-state.tsx",
  "utf8",
);

describe("mobile UI regression contracts", () => {
  it("keeps the Speed Calculus timer drain on one uninterrupted animation", () => {
    assert.match(
      hudSource,
      /const timerRunning =/,
      "the progress animation should be controlled by stable running/paused transitions",
    );
    assert.doesNotMatch(
      hudSource,
      /reactEffect\(\(\) => \{[\s\S]*?progressAnim\.value = withTiming\(0,[\s\S]*?\}, \[[\s\S]*?remainingSeconds[\s\S]*?\]\);/,
      "ordinary timer ticks must not cancel and restart the progress animation",
    );
  });

  it("gives the quest completion counter an unclipped, shared baseline", () => {
    assert.match(
      questHubSource,
      /accessible[\s\S]*?accessibilityLabel=\{`\$\{finishedCount\} \/ \$\{totalCount\}`\}[\s\S]*?className="flex-row items-baseline/,
      "the counter should use sibling text nodes in a baseline-aligned row",
    );
    assert.match(
      questHubSource,
      /text-\[28px\] leading-10[\s\S]*?\{finishedCount\}/,
      "the large counter value needs a line box with vertical breathing room",
    );
  });

  it("keeps quest card entrances inside their final layout bounds", () => {
    assert.doesNotMatch(
      questHubSource,
      /entering=\{FadeInUp/,
      "vertically translated entrances can temporarily draw one quest over another",
    );
  });

  it("keeps cached quests visible when a background refresh fails", () => {
    assert.doesNotMatch(
      questsScreenSource,
      /if \(questsQueryIsError \|\| !questsQueryData\)/,
      "a refetch error must not replace usable cached quests with a full-page error",
    );
    assert.match(questsScreenSource, /if \(!questsQueryData\)/);
  });

  it("includes finalized Perfect Timing results in the quest recap sheet", () => {
    assert.match(
      questsScreenSource,
      /testID: "quests-share-perfect-timing"/,
      "the recap sheet should offer Perfect Timing alongside the other puzzles",
    );
    assert.match(
      questsScreenSource,
      /<PerfectTimingQuestShareCard/,
      "the quest list should render the existing Perfect Timing share card for capture",
    );
  });

  it("keeps the collection mounted behind its transparent card-detail route", () => {
    assert.doesNotMatch(
      collectionSource,
      /if \(!screenFocused\) \{\s*return null;\s*\}/,
      "losing route focus must stop animation work without blanking the collection",
    );
    assert.match(
      collectionSource,
      /animationsEnabled=\{\s*screenFocused &&\s*appActive &&\s*visibleCardIds\.has\(item\.id\)\s*\}/,
      "off-focus collection cards should remain mounted but stop their animations",
    );
    assert.match(
      collectionSource,
      /\[accessToken, appActive, router, screenFocused, visibleCardIds\]/,
      "focus changes should refresh visible tiles so their animations actually stop and resume",
    );
  });

  it("keeps Gifts and Settings on the same header action surface", () => {
    assert.match(
      appHeaderSource,
      /const HEADER_ACTION_SURFACE_STYLE = \{[\s\S]*?width: 40,[\s\S]*?height: 40,/,
      "header actions should share one explicit 40 by 40 surface",
    );
    assert.equal(
      appHeaderSource.match(/\.\.\.HEADER_ACTION_SURFACE_STYLE/g)?.length,
      2,
      "both Gifts and Settings should use the shared header action surface",
    );
  });

  it("keeps leaderboard public profiles discoverable from every ranking placement", () => {
    assert.match(rankingsSource, /pathname: "\/public-profile"/);
    assert.match(rankingsSource, /<PodiumCard[\s\S]*?onPress=/);
    assert.match(rankingsSource, /<RankingRow[\s\S]*?onPress=/);
  });

  it("treats an unfinished worldwide daily period as a pending leaderboard", () => {
    assert.match(
      rankingsSource,
      /queryError instanceof ApiClientError[\s\S]*?LEADERBOARD_PERIOD_UNAVAILABLE/,
      "the typed period-unavailable response should select the pending state",
    );
    assert.match(rankingsSource, /<YesterdayPendingPanel \/>/);
    assert.match(rankingsSource, /testID="leaderboard-yesterday-pending"/);
    assert.doesNotMatch(
      rankingsSource,
      /contentInsetAdjustmentBehavior="automatic"/,
      "automatic insets must not duplicate the app header spacing",
    );
  });

  it("keeps selected quest chips structurally identical with reversed colors", () => {
    const boardSelectorSource = rankingsSource.slice(
      rankingsSource.indexOf("{BOARD_OPTIONS.map"),
      rankingsSource.indexOf("{modeOptions.length"),
    );

    assert.doesNotMatch(
      boardSelectorSource,
      /<LinearGradient/,
      "selected quests should not switch to a separate gradient component",
    );
    assert.match(
      boardSelectorSource,
      /selected \? "bg-primaryText" : "bg-surface"/,
      "only the quest chip background color should change when selected",
    );
    assert.match(
      boardSelectorSource,
      /selected \? "text-surface" : "text-primaryText"/,
      "the selected quest label should reverse the unselected label colors",
    );
  });

  it("uses the canonical French name for Daily Numbers in rankings", () => {
    assert.match(frenchRankingsSource, /dailyNumbers: "Nombre du jour"/);
    assert.doesNotMatch(frenchRankingsSource, /Le compte est bon/);
  });

  it("keeps the loading card free of clipped platform shadows", () => {
    assert.doesNotMatch(loadingStateSource, /boxShadow:/);
  });
});
