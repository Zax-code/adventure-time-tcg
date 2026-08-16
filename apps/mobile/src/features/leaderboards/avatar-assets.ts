import type { ImageSource } from "expo-image";

import type { FallbackAvatarKey } from "@adventure-time/api-client";

export const LEADERBOARD_AVATAR_SOURCES: Record<
  FallbackAvatarKey,
  ImageSource
> = {
  finn: require("../../../../../packages/theme/assets/default-avatars/finn.png"),
  jake: require("../../../../../packages/theme/assets/default-avatars/jake.png"),
  "princess-bubblegum": require("../../../../../packages/theme/assets/default-avatars/princess-bubblegum.png"),
  marceline: require("../../../../../packages/theme/assets/default-avatars/marceline.png"),
  bmo: require("../../../../../packages/theme/assets/default-avatars/bmo.png"),
  "ice-king": require("../../../../../packages/theme/assets/default-avatars/ice-king.png"),
  "flame-princess": require("../../../../../packages/theme/assets/default-avatars/flame-princess.png"),
  "lumpy-space-princess": require("../../../../../packages/theme/assets/default-avatars/lumpy-space-princess.png"),
  "lady-rainicorn": require("../../../../../packages/theme/assets/default-avatars/lady-rainicorn.png"),
  gunter: require("../../../../../packages/theme/assets/default-avatars/gunter.png"),
  "peppermint-butler": require("../../../../../packages/theme/assets/default-avatars/peppermint-butler.png"),
  "tree-trunks": require("../../../../../packages/theme/assets/default-avatars/tree-trunks.png"),
};
