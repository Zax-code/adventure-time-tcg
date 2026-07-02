import { Image } from "expo-image";

import { API_BASE_URL } from "./api";

const prefetchedCardImages = new Set<string>();

export function getCardImageUrl(imageAssetId: string) {
  return `${API_BASE_URL}/media/card/${imageAssetId}`;
}

export function getCardImageCacheKey(imageAssetId: string) {
  return `card:${imageAssetId}`;
}

export async function prefetchCardImages(imageAssetIds: Array<string | null | undefined>) {
  const pendingIds = imageAssetIds.filter(
    (imageAssetId): imageAssetId is string =>
      typeof imageAssetId === "string" &&
      !prefetchedCardImages.has(imageAssetId),
  );

  if (!pendingIds.length) {
    return;
  }

  pendingIds.forEach((imageAssetId) => prefetchedCardImages.add(imageAssetId));

  try {
    await Image.prefetch(
      pendingIds.map((imageAssetId) => getCardImageUrl(imageAssetId)),
      "memory-disk",
    );
  } catch {
    pendingIds.forEach((imageAssetId) => prefetchedCardImages.delete(imageAssetId));
  }
}
