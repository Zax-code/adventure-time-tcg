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
  errorMs: number,
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
      kind: "duration_error_ms",
      outcome: "success",
      absoluteErrorMs: errorMs,
      tier: errorMs <= 50 ? "amazing" : "great",
    },
    points,
    pointsMilli: points * 1_000,
    provisional: true,
    medal,
  };
}

const previewRows = [
  row(1, 1, "FinnTheHero", "finn", 42, 874, "gold"),
  row(2, 2, "BubbleGum", "princess-bubblegum", 58, 826, "silver"),
  row(3, 3, "JakeTheDog", "jake", 63, 811, "bronze"),
  row(4, 4, "MarcyRocks", "marceline", 71, 787),
  row(5, 5, "IceKingCool", "ice-king", 79, 763),
  row(6, 6, "FlamePrincess", "flame-princess", 88, 736),
  row(7, 7, "LSPForever", "lumpy-space-princess", 95, 715),
];

const topSevenCurrentPlayer = row(5, 5, "BMO Player", "bmo", 79, 763);
const topSevenPreviewRows = [
  ...previewRows.slice(0, 4),
  topSevenCurrentPlayer,
  ...previewRows.slice(5),
];

export const RANKINGS_PREVIEW_DATA: LeaderboardResponse = {
  board: {
    key: "perfect-timing/official",
    quest: "perfect-timing",
    family: "perfect_timing",
    mode: "official",
    direction: "lower",
    boardKind: "source",
    rawResultKind: "duration_error_ms",
    enabled: true,
    prizesEnabled: true,
    displayOrder: 10,
    members: [],
  },
  period: {
    type: "week",
    status: "open",
    startsAt: "2026-08-10T04:00:00.000Z",
    endsAt: "2026-08-17T04:00:00.000Z",
    closesAt: "2026-08-17T20:15:00.000Z",
    serverNow: "2026-08-15T21:00:00.000Z",
    revision: 1,
    provisional: true,
    standingsThrough: "2026-08-13",
    prizesEnabled: false,
  },
  podium: previewRows.slice(0, 3),
  rows: previewRows,
  currentPlayer: row(8, 8, "BMO Player", "bmo", 101, 697),
  pendingCurrentPlayerResult: null,
  pendingCurrentPlayerPoints: null,
  qualification: null,
  pageInfo: { nextCursor: null, hasNextPage: false },
  scoring: {
    version: "2026-W34-v1",
    displayMax: 1_000,
    weeklyRule: "average_best_3",
  },
};

export const RANKINGS_TOP_SEVEN_PREVIEW_DATA: LeaderboardResponse = {
  ...RANKINGS_PREVIEW_DATA,
  podium: topSevenPreviewRows.slice(0, 3),
  rows: topSevenPreviewRows,
  currentPlayer: topSevenCurrentPlayer,
  pageInfo: { nextCursor: null, hasNextPage: false },
};
