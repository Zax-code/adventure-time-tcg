import { useEffect } from "react";

import { apiClient } from "../lib/api";
import { prefetchCatalogImages } from "../lib/catalog-images";
import { queryClient } from "../lib/query-client";
import type { BootstrapPhase } from "../stores/session-store";

export function useWarmPackVisuals(
  accessToken: string | null | undefined,
  bootstrapPhase: BootstrapPhase,
) {
  useEffect(() => {
    if (!accessToken || bootstrapPhase !== "ready") {
      return;
    }

    let cancelled = false;

    async function warmPackVisuals() {
      try {
        const response = await queryClient.fetchQuery({
          queryKey: ["packs"],
          queryFn: () => apiClient.packs(),
          staleTime: 5 * 60 * 1000,
        });

        if (cancelled) {
          return;
        }

        await prefetchCatalogImages([
          ...response.packs.map((pack) => pack.packArtAssetId),
          ...response.cardBackVisuals.map((visual) => visual.imageAssetId),
        ]);
      } catch {
        // Background visual warmup is best-effort only.
      }
    }

    void warmPackVisuals();

    return () => {
      cancelled = true;
    };
  }, [accessToken, bootstrapPhase]);
}
