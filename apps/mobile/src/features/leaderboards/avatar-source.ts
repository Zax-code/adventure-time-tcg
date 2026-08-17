export function buildLeaderboardAvatarSource<TFallback>(
  avatarUrl: string | null,
  accessToken: string | null,
  fallbackSource: TFallback,
) {
  if (!avatarUrl || !accessToken) return fallbackSource;

  return {
    uri: avatarUrl,
    headers: { Authorization: `Bearer ${accessToken}` },
  };
}
