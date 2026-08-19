import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const hudSource = readFileSync(
  "src/features/quests/speed-calculus/hud-card.tsx",
  "utf8",
);
const speedCalculusQuestionSource = readFileSync(
  "src/features/quests/speed-calculus/question-zone.tsx",
  "utf8",
);
const speedCalculusKeypadSource = readFileSync(
  "src/features/quests/speed-calculus/keypad.tsx",
  "utf8",
);
const englishQuestsSource = readFileSync(
  "src/i18n/locales/en/quests.ts",
  "utf8",
);
const frenchQuestsSource = readFileSync(
  "src/i18n/locales/fr/quests.ts",
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
const leaderboardRawResultSource = readFileSync(
  "src/features/leaderboards/format-raw-result.ts",
  "utf8",
);
const leaderboardHelpSource = readFileSync("app/leaderboard-help.tsx", "utf8");
const appLayoutSource = readFileSync("app/_layout.tsx", "utf8");
const leaderboardAvatarSource = readFileSync(
  "src/features/leaderboards/leaderboard-avatar.tsx",
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
const adminUsersSource = readFileSync("app/admin/users.tsx", "utf8");
const adminEnglishSource = readFileSync("src/i18n/locales/en/admin.ts", "utf8");
const adminFrenchSource = readFileSync("src/i18n/locales/fr/admin.ts", "utf8");

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

  it("uses only the ring for the Speed Calculus entry countdown", () => {
    assert.doesNotMatch(
      speedCalculusQuestionSource,
      /speedCalculusResumeCountdownBody/,
      "the entry countdown must not claim that a newly started run is resuming",
    );
    assert.doesNotMatch(
      englishQuestsSource,
      /speedCalculusResumeCountdownBody/,
    );
    assert.doesNotMatch(frenchQuestsSource, /speedCalculusResumeCountdownBody/);
  });

  it("routes Speed Calculus multi-touch once at the keypad boundary", () => {
    assert.match(
      speedCalculusKeypadSource,
      /onTouchStart=\{handleKeypadTouchStart\}/,
      "the keypad container should own the native multi-pointer stream",
    );
    assert.match(
      speedCalculusKeypadSource,
      /pointerEvents="none"/,
      "individual keys must not capture Android's whole multi-pointer gesture",
    );
    assert.doesNotMatch(
      speedCalculusKeypadSource,
      /activeTouchCountRef|pressForChangedTouches/,
      "per-key touch counting would misroute or duplicate multi-touch input",
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
    assert.match(rankingsSource, /<TiedRankGroup[\s\S]*?onPress=/);
    assert.match(rankingsSource, /<RankingRow[\s\S]*?onPress=/);
  });

  it("authenticates custom profile pictures throughout the rankings", () => {
    assert.equal(
      rankingsSource.match(/avatarUrl=\{row\.profile\.avatarUrl\}/g)?.length,
      3,
      "podium cards, tied-rank rows, and ranking rows should pass the public profile picture to LeaderboardAvatar",
    );
    assert.match(
      leaderboardAvatarSource,
      /useSessionStore\(\(state\) => state\.accessToken\)/,
      "LeaderboardAvatar should subscribe to the current access token",
    );
    assert.match(
      leaderboardAvatarSource,
      /buildLeaderboardAvatarSource\([\s\S]*?avatarUrl,[\s\S]*?accessToken,/,
      "LeaderboardAvatar should authenticate uploaded profile-image requests",
    );
  });

  it("keeps live daily and weekly period selectors refreshable", () => {
    for (const option of [
      '"daily"',
      '"weekly"',
      '"today"',
      '"yesterday"',
      '"current_week"',
      '"last_week"',
    ]) {
      assert.match(rankingsSource, new RegExp(option));
    }
    assert.match(rankingsSource, /testID=\{`rankings-period-\$\{/);
    assert.match(rankingsSource, /refetchInterval: 60_000/);
    assert.match(rankingsSource, /<RefreshControl/);
    assert.match(rankingsSource, /queryIsFetching/);
    assert.doesNotMatch(rankingsSource, /YesterdayPendingPanel/);
    assert.doesNotMatch(rankingsSource, /const average =/);
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

  it("opens rankings on the all-quests board", () => {
    assert.match(rankingsSource, /key: "overall\/all-quests"/);
    assert.match(
      rankingsSource,
      /useState<LeaderboardBoardKey>\(\s*isLoadingPreview \? "steps\/default" : "overall\/all-quests",\s*\)/,
    );
  });

  it("shows player-friendly source result units", () => {
    assert.match(leaderboardRawResultSource, /rankings\.results\.steps/);
    assert.match(leaderboardRawResultSource, /rankings\.results\.oneGuess/);
    assert.match(leaderboardRawResultSource, /rankings\.results\.guesses/);
    assert.match(leaderboardRawResultSource, /minimumFractionDigits: 2/);
    assert.match(leaderboardRawResultSource, /maximumFractionDigits: 2/);
  });

  it("opens a shared leaderboard explanation sheet with every scoring section", () => {
    assert.match(rankingsSource, /router\.push\("\/leaderboard-help"\)/);
    assert.match(rankingsSource, /testID="rankings-open-help-button"/);
    assert.match(appLayoutSource, /name="leaderboard-help"/);
    assert.match(leaderboardHelpSource, /<ModalSheetRoute/);
    for (const section of [
      "allQuestsFormula",
      "stepsFormula",
      "dailyNumbersFormulaFast",
      "dailyNumbersFormulaSlow",
      "wordleFormula",
      "speedCalculusFormula",
      "perfectTimingFormula",
      "periodsCutoff",
    ]) {
      assert.match(leaderboardHelpSource, new RegExp(section));
    }
  });

  it("counts down every provisional leaderboard from authoritative server time", () => {
    assert.match(rankingsSource, /useCloseCountdown\(data\.period\)/);
    assert.match(rankingsSource, /Date\.parse\(period\.serverNow\)/);
    assert.match(rankingsSource, /Date\.parse\(period\.closesAt\)/);
    assert.match(rankingsSource, /setInterval\([\s\S]*?60_000/);
    assert.match(rankingsSource, /testID="rankings-close-countdown"/);
  });

  it("uses the canonical French name for Daily Numbers in rankings", () => {
    assert.match(frenchRankingsSource, /dailyNumbers: "Nombre du jour"/);
    assert.match(frenchRankingsSource, /oneGuess: "\{count\} essai"/);
    assert.match(frenchRankingsSource, /guesses: "\{count\} essais"/);
    assert.doesNotMatch(frenchRankingsSource, /Le compte est bon/);
  });

  it("keeps the loading card free of clipped platform shadows", () => {
    assert.doesNotMatch(loadingStateSource, /boxShadow:/);
  });

  it("keeps access assessments explanatory and accessible without color", () => {
    assert.match(adminUsersSource, /assessment\.confidence/);
    assert.match(adminUsersSource, /assessment\.coverage/);
    assert.match(adminUsersSource, /bandLabel/);
    assert.match(adminUsersSource, /assessment\.network\.testLabRangeStale/);
    assert.match(adminUsersSource, /assessment\.network\.googleRangeStale/);
    assert.match(adminUsersSource, /<AdminButton[\s\S]*?showEvidence/);
    assert.doesNotMatch(
      adminUsersSource,
      /reasons=\{assessment\.(?:missingReasons|hardFailureReasons)\}/,
      "backend reason codes must be translated before rendering",
    );
    assert.match(adminEnglishSource, /assessmentTestLabWarning:/);
    assert.match(adminFrenchSource, /assessmentTestLabWarning:/);
    assert.match(adminEnglishSource, /assessmentReasons: \{/);
    assert.match(adminFrenchSource, /assessmentReasons: \{/);
  });
});
