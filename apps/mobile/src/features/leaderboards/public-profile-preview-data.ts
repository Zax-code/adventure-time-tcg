import type { PublicLeaderboardProfile } from "@adventure-time/api-client";

export const PUBLIC_PROFILE_PREVIEW_DATA: PublicLeaderboardProfile = {
  profile: {
    publicProfileId: "00000000-0000-4000-8000-000000000005",
    displayName: "BMO Player",
    discriminator: "AT05",
    handle: "BMO Player#AT05",
    avatarUrl: null,
    fallbackAvatarKey: "bmo",
    visibility: "visible",
  },
  crowns: {
    steps: 7,
    dailyNumbers: 5,
    wordle: 3,
    speedCalculus: 4,
    perfectTiming: 5,
    total: 24,
  },
  medals: {
    gold: 4,
    silver: 6,
    bronze: 9,
  },
  recentPlacements: [
    {
      boardKey: "perfect-timing/official",
      weekStart: "2026-08-03",
      rank: 1,
      points: 887,
      medal: "gold",
    },
    {
      boardKey: "steps/default",
      weekStart: "2026-07-27",
      rank: 2,
      points: 842,
      medal: "silver",
    },
    {
      boardKey: "daily-numbers/family",
      weekStart: "2026-07-20",
      rank: 3,
      points: 816,
      medal: "bronze",
    },
  ],
  personalBests: [
    {
      boardKey: "perfect-timing/official",
      rawResult: {
        kind: "duration_error_ms",
        outcome: "success",
        absoluteErrorMs: 39,
        tier: "amazing",
      },
      points: 912,
    },
    {
      boardKey: "steps/default",
      rawResult: { kind: "steps", steps: 20_486 },
      points: 876,
    },
    {
      boardKey: "wordle/family",
      rawResult: { kind: "wordle_outcome", outcome: "solved", guesses: 2 },
      points: 900,
    },
  ],
};
