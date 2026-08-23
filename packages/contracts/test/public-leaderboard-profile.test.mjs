import assert from "node:assert/strict";
import test from "node:test";

import { publicLeaderboardProfileSchema } from "../src/index.ts";

test("public leaderboard profiles accept unbounded non-negative personal-best points", () => {
  const profile = publicLeaderboardProfileSchema.parse({
    profile: {
      publicProfileId: "c04e08f2-d2b3-4d9d-adc5-98600e3ea983",
      displayName: "BMO",
      discriminator: "1234",
      handle: "BMO#1234",
      avatarUrl: null,
      fallbackAvatarKey: "bmo",
      visibility: "visible",
    },
    crowns: {
      steps: 0,
      dailyNumbers: 0,
      wordle: 0,
      speedCalculus: 0,
      perfectTiming: 0,
      total: 0,
    },
    medals: {
      gold: 0,
      silver: 0,
      bronze: 0,
    },
    recentPlacements: [],
    personalBests: [
      {
        boardKey: "steps/default",
        rawResult: { kind: "steps", steps: 12_345 },
        points: 1_001,
      },
    ],
  });

  assert.equal(profile.personalBests[0].points, 1_001);

  assert.equal(
    publicLeaderboardProfileSchema.safeParse({
      ...profile,
      personalBests: [{ ...profile.personalBests[0], points: -1 }],
    }).success,
    false,
  );
});
