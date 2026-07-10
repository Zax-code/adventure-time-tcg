import { THEME_NAMES, type ThemeName } from "@adventure-time/theme";

export const APP_ICON_SRC = "/images/app-icon.png";

export const CARD_RARITY_NAMES = [
  "Common",
  "Uncommon",
  "Rare",
  "Epic",
  "Legendary",
] as const;

export type CardRarityName = (typeof CARD_RARITY_NAMES)[number];
export type PackArtKind =
  "basic" | "standard" | "premium" | "epic" | "legendary";
export type MediaKind = "card" | "catalog" | "profile";

export interface ResponsiveImageSource {
  avifSrcSet: string;
  fallback: string;
}

type ImageSourceMap = Record<ThemeName, Record<CardRarityName, string>>;

const PACK_ART_KINDS = [
  "basic",
  "standard",
  "premium",
  "epic",
  "legendary",
] as const satisfies readonly PackArtKind[];

const GAME_ART_ASSETS = import.meta.glob<string>(
  ["../assets/game/**/*.avif", "../assets/game/**/*.png"],
  {
    eager: true,
    import: "default",
    query: "?url",
  },
);

function getGameArtAsset(relativePath: string) {
  const source = GAME_ART_ASSETS[`../assets/game/${relativePath}`];

  if (!source) {
    throw new Error(`Missing bundled game art asset: ${relativePath}`);
  }

  return source;
}

function getCardAssetStem(
  family: "backcovers" | "card-outlines",
  themeName: ThemeName,
  rarityName: CardRarityName,
) {
  const prefix = family === "backcovers" ? "backcover" : "card-outline";
  return `${prefix}-${themeName}-${rarityName.toLowerCase()}`;
}

function createCardFallbackSources(
  family: "backcovers" | "card-outlines",
): ImageSourceMap {
  return Object.fromEntries(
    THEME_NAMES.map((themeName) => [
      themeName,
      Object.fromEntries(
        CARD_RARITY_NAMES.map((rarityName) => {
          const stem = getCardAssetStem(family, themeName, rarityName);
          return [
            rarityName,
            getGameArtAsset(`${family}/${stem}-fallback.png`),
          ];
        }),
      ),
    ]),
  ) as ImageSourceMap;
}

export const CARD_BACK_SOURCES = createCardFallbackSources("backcovers");

export const CARD_OUTLINE_SOURCES = createCardFallbackSources("card-outlines");

export const PACK_ART_SOURCES = Object.fromEntries(
  PACK_ART_KINDS.map((kind) => [
    kind,
    getGameArtAsset(`pack-opening/${kind}-pack-fallback.png`),
  ]),
) as Record<PackArtKind, string>;

function createResponsiveImageSource({
  fallback,
  large,
  small,
}: {
  fallback: string;
  large: string;
  small: string;
}): ResponsiveImageSource {
  return {
    avifSrcSet: `${getGameArtAsset(small)} 1x, ${getGameArtAsset(large)} 2x`,
    fallback,
  };
}

function createCardResponsiveSources(
  family: "backcovers" | "card-outlines",
  sources: ImageSourceMap,
): Record<ThemeName, Record<CardRarityName, ResponsiveImageSource>> {
  return Object.fromEntries(
    THEME_NAMES.map((themeName) => [
      themeName,
      Object.fromEntries(
        CARD_RARITY_NAMES.map((rarityName) => {
          const stem = getCardAssetStem(family, themeName, rarityName);

          return [
            rarityName,
            createResponsiveImageSource({
              fallback: sources[themeName][rarityName],
              small: `${family}/${stem}-512.avif`,
              large: `${family}/${stem}-1024.avif`,
            }),
          ];
        }),
      ),
    ]),
  ) as Record<ThemeName, Record<CardRarityName, ResponsiveImageSource>>;
}

export const CARD_BACK_RESPONSIVE_SOURCES = createCardResponsiveSources(
  "backcovers",
  CARD_BACK_SOURCES,
);

export const CARD_OUTLINE_RESPONSIVE_SOURCES = createCardResponsiveSources(
  "card-outlines",
  CARD_OUTLINE_SOURCES,
);

export const PACK_ART_RESPONSIVE_SOURCES = Object.fromEntries(
  PACK_ART_KINDS.map((kind) => {
    const stem = `${kind}-pack`;

    return [
      kind,
      createResponsiveImageSource({
        fallback: PACK_ART_SOURCES[kind],
        small: `pack-opening/${stem}-640.avif`,
        large: `pack-opening/${stem}-1280.avif`,
      }),
    ];
  }),
) as Record<PackArtKind, ResponsiveImageSource>;

export function isCardRarityName(value: unknown): value is CardRarityName {
  return (
    typeof value === "string" &&
    CARD_RARITY_NAMES.includes(value as CardRarityName)
  );
}

export function normalizeCardRarityName(value: unknown): CardRarityName {
  return isCardRarityName(value) ? value : "Common";
}

function withBaseUrl(path: string, baseUrl = "") {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/$/, "");
  return normalizedBaseUrl ? `${normalizedBaseUrl}${path}` : path;
}

function getMediaUrl(kind: MediaKind, imageAssetId: string, baseUrl = "") {
  return withBaseUrl(
    `/media/${kind}/${encodeURIComponent(imageAssetId)}`,
    baseUrl,
  );
}

export function getCardMediaUrl(imageAssetId: string, baseUrl = "") {
  return getMediaUrl("card", imageAssetId, baseUrl);
}

export function getCatalogMediaUrl(imageAssetId: string, baseUrl = "") {
  return getMediaUrl("catalog", imageAssetId, baseUrl);
}

export function getProfileMediaUrl(imageAssetId: string, baseUrl = "") {
  return getMediaUrl("profile", imageAssetId, baseUrl);
}

export function normalizeMediaUrl(
  value: string | null | undefined,
  { baseUrl = "", kind = "card" }: { baseUrl?: string; kind?: MediaKind } = {},
) {
  const candidate = value?.trim();
  if (!candidate) {
    return null;
  }

  if (/^[a-z][a-z\d+.-]*:/i.test(candidate)) {
    return candidate;
  }

  const normalizedPath = candidate.startsWith("/api/media/")
    ? candidate.slice(4)
    : candidate;

  if (normalizedPath.startsWith("/")) {
    return withBaseUrl(normalizedPath, baseUrl);
  }

  return getMediaUrl(kind, normalizedPath, baseUrl);
}

export function getCardBackSource(
  themeName: ThemeName,
  rarityName: CardRarityName,
  imageAssetId?: string | null,
  baseUrl = "",
) {
  return imageAssetId
    ? getCatalogMediaUrl(imageAssetId, baseUrl)
    : CARD_BACK_SOURCES[themeName][rarityName];
}

export function getBundledCardBackResponsiveSource(
  themeName: ThemeName,
  rarityName: CardRarityName,
) {
  return CARD_BACK_RESPONSIVE_SOURCES[themeName][rarityName];
}

export function getCardOutlineSource(
  themeName: ThemeName,
  rarityName: CardRarityName,
) {
  return CARD_OUTLINE_SOURCES[themeName][rarityName];
}

export function getCardOutlineResponsiveSource(
  themeName: ThemeName,
  rarityName: CardRarityName,
) {
  return CARD_OUTLINE_RESPONSIVE_SOURCES[themeName][rarityName];
}

export function getPackArtKind({
  guaranteedRarity,
  name,
}: {
  guaranteedRarity?: string | null;
  name: string;
}): PackArtKind {
  const normalizedName = name.toLowerCase();

  if (
    normalizedName.includes("legendary") ||
    guaranteedRarity === "Legendary"
  ) {
    return "legendary";
  }
  if (normalizedName.includes("epic") || guaranteedRarity === "Epic") {
    return "epic";
  }
  if (normalizedName.includes("premium") || guaranteedRarity === "Rare") {
    return "premium";
  }
  if (normalizedName.includes("standard")) {
    return "standard";
  }

  return "basic";
}

export interface PackArtInput {
  guaranteedRarity?: string | null;
  name: string;
  packArtAssetId?: string | null;
  packArtUrl?: string | null;
}

export function getBundledPackArtSource(pack: PackArtInput) {
  return PACK_ART_SOURCES[getPackArtKind(pack)];
}

export function getBundledPackArtResponsiveSource(pack: PackArtInput) {
  return PACK_ART_RESPONSIVE_SOURCES[getPackArtKind(pack)];
}

export function getPackArtSource(pack: PackArtInput, baseUrl = "") {
  if (pack.packArtUrl) {
    return normalizeMediaUrl(pack.packArtUrl, {
      baseUrl,
      kind: "catalog",
    });
  }
  if (pack.packArtAssetId) {
    return getCatalogMediaUrl(pack.packArtAssetId, baseUrl);
  }

  return getBundledPackArtSource(pack);
}

export class MediaRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "MediaRequestError";
  }
}

export interface AuthenticatedProfileObjectUrl {
  url: string;
  revoke: () => void;
}

export async function fetchAuthenticatedProfileObjectUrl({
  accessToken,
  baseUrl = "",
  fetchImplementation = fetch,
  imageAssetId,
  signal,
}: {
  accessToken: string;
  baseUrl?: string;
  fetchImplementation?: typeof fetch;
  imageAssetId: string;
  signal?: AbortSignal;
}): Promise<AuthenticatedProfileObjectUrl> {
  if (!accessToken.trim()) {
    throw new MediaRequestError("A profile image access token is required", 0);
  }

  const response = await fetchImplementation(
    getProfileMediaUrl(imageAssetId, baseUrl),
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal,
    },
  );

  if (!response.ok) {
    throw new MediaRequestError(
      `Profile image request failed with status ${response.status}`,
      response.status,
    );
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  let revoked = false;

  return {
    url,
    revoke() {
      if (!revoked) {
        URL.revokeObjectURL(url);
        revoked = true;
      }
    },
  };
}
