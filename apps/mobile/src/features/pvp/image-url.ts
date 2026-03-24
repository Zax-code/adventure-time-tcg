import { API_BASE_URL } from "../../lib/api";

export function resolveBattleImageUrl(imageUrl: string | null | undefined) {
  if (!imageUrl) {
    return null;
  }

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  if (imageUrl.startsWith("/api/media/card/")) {
    return `${API_BASE_URL}${imageUrl.slice(4)}`;
  }

  if (imageUrl.startsWith("/media/card/") || imageUrl.startsWith("/")) {
    return `${API_BASE_URL}${imageUrl}`;
  }

  return `${API_BASE_URL}/media/card/${imageUrl}`;
}
