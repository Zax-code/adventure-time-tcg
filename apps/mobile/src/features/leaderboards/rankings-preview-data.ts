import type {
  FallbackAvatarKey,
  LeaderboardResponse,
  LeaderboardRow,
} from "@adventure-time/api-client";

function row(
  position: number,
  rank: number,
  name: string,
  avatar: FallbackAvatarKey,
  points: number,
  medal: "gold" | "silver" | "bronze" | null = null,
): LeaderboardRow {
  return {
    position,
    rank,
    profile: {
      publicProfileId: "00000000-0000-4000-8000-00000000000" + position,
      displayName: name,
      discriminator: "AT" + String(position).padStart(2, "0"),
      handle: `${name}#AT${String(position).padStart(2, "0")}`,
      avatarUrl: null,
      fallbackAvatarKey: avatar,
      visibility: "visible",
    },
    rawResult: {
      kind: "member_breakdown",
      members: {
        "steps/default": points * 1_000,
        "daily-numbers/family": 0,
        "wordle/family": 0,
        "speed-calculus/ranked": 0,
        "perfect-timing/official": 0,
      },
    },
    points,
    pointsMilli: points * 1_000,
    provisional: true,
    medal,
  };
}

const previewRows = [
  row(1, 1, "FinnTheHero", "finn", 1_046, "gold"),
  row(2, 2, "BubbleGum", "princess-bubblegum", 987, "silver"),
  row(3, 3, "JakeTheDog", "jake", 969, "bronze"),
  row(4, 4, "MarcyRocks", "marceline", 940),
  row(5, 5, "IceKingCool", "ice-king", 910),
  row(6, 6, "FlamePrincess", "flame-princess", 877),
  row(7, 7, "LSPForever", "lumpy-space-princess", 852),
];

const topSevenCurrentPlayer = row(5, 5, "BMO Player", "bmo", 910);
const topSevenPreviewRows = [
  ...previewRows.slice(0, 4),
  topSevenCurrentPlayer,
  ...previewRows.slice(5),
];

const tiedPreviewRows = [
  row(1, 1, "FinnTheHero", "finn", 1_046, "gold"),
  row(2, 2, "BubbleGum", "princess-bubblegum", 987, "silver"),
  row(3, 3, "JakeTheDog", "jake", 969, "bronze"),
  row(4, 3, "MarcyRocks", "marceline", 969, "bronze"),
  row(5, 3, "BMO Player", "bmo", 969, "bronze"),
  row(6, 6, "IceKingCool", "ice-king", 910),
];

export const RANKINGS_PREVIEW_DATA: LeaderboardResponse = {
  board: {
    key: "overall/all-quests",
    quest: "overall",
    family: "overall",
    mode: "all-quests",
    direction: "points",
    boardKind: "derived_overall",
    rawResultKind: "member_breakdown",
    enabled: true,
    prizesEnabled: false,
    displayOrder: 11,
    members: [
      "steps/default",
      "daily-numbers/family",
      "wordle/family",
      "speed-calculus/ranked",
      "perfect-timing/official",
    ],
  },
  period: {
    type: "week",
    status: "open",
    startsAt: "2026-08-17T00:00:00.000Z",
    endsAt: "2026-08-24T00:00:00.000Z",
    closesAt: "2026-08-24T13:00:00.000Z",
    serverNow: "2026-08-15T21:00:00.000Z",
    revision: 1,
    provisional: true,
    competitionDate: null,
    weekStart: "2026-08-17",
    weekEnd: "2026-08-23",
    standingsThrough: "2026-08-23",
    prizesEnabled: false,
  },
  podium: previewRows.slice(0, 3),
  rows: previewRows,
  currentPlayer: row(8, 8, "BMO Player", "bmo", 830),
  pendingCurrentPlayerResult: null,
  pendingCurrentPlayerPoints: null,
  qualification: null,
  pageInfo: { nextCursor: null, hasNextPage: false },
  scoring: {
    version: "2026-W34-v2",
    weeklyRule: "sum_all_eligible",
  },
};

export const RANKINGS_TOP_SEVEN_PREVIEW_DATA: LeaderboardResponse = {
  ...RANKINGS_PREVIEW_DATA,
  podium: topSevenPreviewRows.slice(0, 3),
  rows: topSevenPreviewRows,
  currentPlayer: topSevenCurrentPlayer,
  pageInfo: { nextCursor: null, hasNextPage: false },
};

export const RANKINGS_TIED_PREVIEW_DATA: LeaderboardResponse = {
  ...RANKINGS_PREVIEW_DATA,
  podium: tiedPreviewRows.filter((previewRow) => previewRow.rank <= 3),
  rows: tiedPreviewRows,
  currentPlayer: tiedPreviewRows[5],
  pageInfo: { nextCursor: null, hasNextPage: false },
};
