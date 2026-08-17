import { Image } from "expo-image";

import type { FallbackAvatarKey } from "@adventure-time/api-client";

import { useSessionStore } from "../../stores/session-store";
import { LEADERBOARD_AVATAR_SOURCES } from "./avatar-assets";
import { buildLeaderboardAvatarSource } from "./avatar-source";

export function LeaderboardAvatar({
  avatarKey,
  avatarUrl,
  size,
}: {
  avatarKey: FallbackAvatarKey;
  avatarUrl: string | null;
  size: number;
}) {
  const accessToken = useSessionStore((state) => state.accessToken);

  return (
    <Image
      source={buildLeaderboardAvatarSource(
        avatarUrl,
        accessToken,
        LEADERBOARD_AVATAR_SOURCES[avatarKey],
      )}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      contentFit="cover"
      transition={150}
    />
  );
}
