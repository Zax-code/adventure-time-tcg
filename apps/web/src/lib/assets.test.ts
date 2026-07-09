import { afterEach, describe, expect, it, vi } from "vitest";

import {
  APP_ICON_SRC,
  CARD_BACK_SOURCES,
  CARD_BACK_RESPONSIVE_SOURCES,
  CARD_OUTLINE_SOURCES,
  CARD_OUTLINE_RESPONSIVE_SOURCES,
  fetchAuthenticatedProfileObjectUrl,
  getCardBackSource,
  getPackArtKind,
  getPackArtSource,
  MediaRequestError,
  normalizeMediaUrl,
  PACK_ART_SOURCES,
  PACK_ART_RESPONSIVE_SOURCES,
} from "./assets";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("bundled game art", () => {
  it("uses the canonical Phoenix app icon and compact generated fallbacks", () => {
    expect(APP_ICON_SRC).toBe("/images/app-icon.png");

    const fallbackSources = [
      ...Object.values(CARD_BACK_SOURCES).flatMap(Object.values),
      ...Object.values(CARD_OUTLINE_SOURCES).flatMap(Object.values),
      ...Object.values(PACK_ART_SOURCES),
    ];

    expect(fallbackSources).toHaveLength(35);
    expect(
      fallbackSources.every(
        (source) =>
          source.includes("fallback") && !source.includes("mobile/assets"),
      ),
    ).toBe(true);
  });

  it("maps all three themes and five rarities", () => {
    for (const themeName of ["candy", "ice", "nightosphere"] as const) {
      expect(Object.keys(CARD_BACK_SOURCES[themeName])).toHaveLength(5);
      expect(Object.keys(CARD_OUTLINE_SOURCES[themeName])).toHaveLength(5);
      expect(
        CARD_BACK_RESPONSIVE_SOURCES[themeName].Common.avifSrcSet,
      ).toContain(" 2x");
      expect(
        CARD_OUTLINE_RESPONSIVE_SOURCES[themeName].Legendary.avifSrcSet,
      ).toContain(" 2x");
    }

    expect(Object.keys(PACK_ART_SOURCES)).toEqual([
      "basic",
      "standard",
      "premium",
      "epic",
      "legendary",
    ]);
    expect(PACK_ART_RESPONSIVE_SOURCES.legendary.avifSrcSet).toContain(" 2x");
  });

  it("uses catalog overrides before bundled card backs and pack art", () => {
    expect(getCardBackSource("ice", "Rare", "back-id")).toBe(
      "/media/catalog/back-id",
    );
    expect(
      getPackArtSource({ name: "Epic Pack", packArtAssetId: "pack-id" }),
    ).toBe("/media/catalog/pack-id");
    expect(
      getPackArtKind({ name: "Basic Pack", guaranteedRarity: "Rare" }),
    ).toBe("premium");
  });
});

describe("media URL normalization", () => {
  it("normalizes battle API paths, bare ids, and absolute URLs", () => {
    expect(
      normalizeMediaUrl("/api/media/card/card-id", {
        baseUrl: "https://app.example/",
      }),
    ).toBe("https://app.example/media/card/card-id");
    expect(
      normalizeMediaUrl("card-id", {
        baseUrl: "https://app.example",
      }),
    ).toBe("https://app.example/media/card/card-id");
    expect(normalizeMediaUrl("https://cdn.example/card.webp")).toBe(
      "https://cdn.example/card.webp",
    );
  });
});

describe("authenticated profile media", () => {
  it("fetches with bearer auth and returns an explicitly revocable object URL", async () => {
    const fetchImplementation = vi.fn(
      async () =>
        new Response(new Blob(["avatar"], { type: "image/png" }), {
          status: 200,
        }),
    );
    const createObjectURL = vi.fn(() => "blob:profile-image");
    const revokeObjectURL = vi.fn();
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: createObjectURL },
      revokeObjectURL: { configurable: true, value: revokeObjectURL },
    });

    const result = await fetchAuthenticatedProfileObjectUrl({
      accessToken: "access-token",
      baseUrl: "https://app.example",
      fetchImplementation,
      imageAssetId: "profile-id",
    });

    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://app.example/media/profile/profile-id",
      expect.objectContaining({
        headers: { Authorization: "Bearer access-token" },
      }),
    );
    expect(result.url).toBe("blob:profile-image");

    result.revoke();
    result.revoke();
    expect(revokeObjectURL).toHaveBeenCalledOnce();
  });

  it("rejects missing auth before issuing a request", async () => {
    await expect(
      fetchAuthenticatedProfileObjectUrl({
        accessToken: " ",
        imageAssetId: "profile-id",
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<MediaRequestError>>({ status: 0 }),
    );
  });
});
