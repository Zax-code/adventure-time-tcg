import { Image } from "expo-image";

import { API_BASE_URL } from "./api-config";

const prefetchedCatalogImages = new Set<string>();

export function getCatalogImageUrl(imageAssetId: string) {
  return `${API_BASE_URL}/media/catalog/${imageAssetId}`;
}

function getCatalogImageCacheKey(imageAssetId: string) {
  return `catalog:${imageAssetId}`;
}

export async function prefetchCatalogImages(
  imageAssetIds: Array<string | null | undefined>,
) {
  const pendingIds = imageAssetIds.filter(
    (imageAssetId): imageAssetId is string =>
      typeof imageAssetId === "string" &&
      !prefetchedCatalogImages.has(imageAssetId),
  );

  if (!pendingIds.length) {
    return;
  }

  pendingIds.forEach((imageAssetId) => prefetchedCatalogImages.add(imageAssetId));

  try {
    await Image.prefetch(
      pendingIds.map((imageAssetId) => getCatalogImageUrl(imageAssetId)),
      "memory-disk",
    );
  } catch {
    pendingIds.forEach((imageAssetId) =>
      prefetchedCatalogImages.delete(imageAssetId),
    );
  }
}
