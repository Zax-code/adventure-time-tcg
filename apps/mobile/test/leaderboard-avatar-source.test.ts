import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { buildLeaderboardAvatarSource } from "../src/features/leaderboards/avatar-source.ts";

describe("leaderboard avatar source", () => {
  const fallbackSource = { fallback: "bmo" };

  it("authenticates remote profile image requests", () => {
    assert.deepEqual(
      buildLeaderboardAvatarSource(
        "https://app.example/media/profile/avatar-id",
        "access-token",
        fallbackSource,
      ),
      {
        uri: "https://app.example/media/profile/avatar-id",
        headers: { Authorization: "Bearer access-token" },
      },
    );
  });

  it("uses the fallback avatar when no uploaded avatar exists", () => {
    assert.equal(
      buildLeaderboardAvatarSource(null, "access-token", fallbackSource),
      fallbackSource,
    );
  });

  it("does not issue an unauthorized image request while the session is unavailable", () => {
    assert.equal(
      buildLeaderboardAvatarSource(
        "https://app.example/media/profile/avatar-id",
        null,
        fallbackSource,
      ),
      fallbackSource,
    );
  });

  it("uses the authenticated avatar component on every leaderboard profile surface", () => {
    const rankingsSource = readFileSync(
      "src/features/leaderboards/rankings-screen.tsx",
      "utf8",
    );
    const publicProfileSource = readFileSync(
      "src/features/leaderboards/public-profile-screen.tsx",
      "utf8",
    );
    const avatarComponentSource = readFileSync(
      "src/features/leaderboards/leaderboard-avatar.tsx",
      "utf8",
    );

    assert.match(rankingsSource, /<LeaderboardAvatar/);
    assert.match(publicProfileSource, /<LeaderboardAvatar/);
    assert.match(
      avatarComponentSource,
      /useSessionStore\(\(state\) => state\.accessToken\)/,
    );
    assert.match(avatarComponentSource, /buildLeaderboardAvatarSource\(/);
  });
});
