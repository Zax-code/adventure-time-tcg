import { LinearGradient } from "expo-linear-gradient";
import { Text, View } from "react-native";

import type { LeaderboardRow } from "@adventure-time/api-client";

import { LeaderboardAvatar } from "./leaderboard-avatar";

// Gradient pairs from the board 05 Rankings design, picked per player so the
// initials fallback stays stable between renders.
const AVATAR_GRADIENTS: Array<[string, string]> = [
  ["#F9A8D4", "#C084FC"],
  ["#93C5FD", "#A78BFA"],
  ["#FDE68A", "#F9A8D4"],
  ["#F472B6", "#FDBA74"],
  ["#FCD34D", "#FB923C"],
  ["#93C5FD", "#67E8F9"],
  ["#C084FC", "#F472B6"],
];

export function avatarInitials(displayName: string) {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length > 1
      ? `${words[0][0]}${words[1][0]}`
      : (words[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

function gradientFor(key: string) {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) | 0;
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

// A round player avatar with a colored ring. The player's picture (uploaded
// avatar or chosen character) sits on top of initials on a gradient, which
// stay visible when the picture cannot load.
export function RankingsAvatar({
  profile,
  size,
  ringWidth,
  ringClassName,
}: {
  profile: LeaderboardRow["profile"];
  size: number;
  ringWidth: number;
  ringClassName: string;
}) {
  const inner = size - ringWidth * 2;

  return (
    <View
      className={`items-center justify-center overflow-hidden rounded-ds-pill ${ringClassName}`}
      style={{ width: size, height: size, borderWidth: ringWidth }}
    >
      <LinearGradient
        colors={gradientFor(profile.handle)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: "absolute", inset: 0 }}
      />
      <Text
        className="font-nunito-extrabold text-white"
        style={{ fontSize: Math.round(size * 0.36) }}
      >
        {avatarInitials(profile.displayName ?? profile.handle)}
      </Text>
      <View className="absolute inset-0">
        <LeaderboardAvatar
          avatarKey={profile.fallbackAvatarKey}
          avatarUrl={profile.avatarUrl}
          size={inner}
        />
      </View>
    </View>
  );
}
