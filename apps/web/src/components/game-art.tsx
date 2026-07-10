import {
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ImgHTMLAttributes,
  type ReactNode,
} from "react";

import type { ThemeName } from "@adventure-time/theme";

import "../styles/game-art.css";

import { useOptionalTheme } from "../theme/theme-provider";
import {
  fetchAuthenticatedProfileObjectUrl,
  getBundledCardBackResponsiveSource,
  getBundledPackArtSource,
  getBundledPackArtResponsiveSource,
  getCardBackSource,
  getCardMediaUrl,
  getCardOutlineResponsiveSource,
  getPackArtSource,
  normalizeCardRarityName,
  normalizeMediaUrl,
  type CardRarityName,
  type PackArtInput,
  type AuthenticatedProfileObjectUrl,
} from "../lib/assets";

type ManagedImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "alt" | "children" | "src" | "style"
>;

export interface CardArtProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children" | "style"
> {
  alt?: string;
  apiBaseUrl?: string;
  card?: {
    character?: string | null;
    imageAssetId?: string | null;
    imageUrl?: string | null;
    name: string;
    rarity?: { name?: string | null } | null;
  };
  character?: string | null;
  children?: ReactNode;
  imageAssetId?: string | null;
  imageProps?: ManagedImageProps;
  imageUrl?: string | null;
  name?: string;
  outlineProps?: ManagedImageProps;
  rarityName?: CardRarityName;
  themeName?: ThemeName;
}

export function CardArt({
  alt,
  apiBaseUrl = "",
  card,
  character,
  children,
  className,
  imageAssetId,
  imageProps,
  imageUrl,
  name,
  outlineProps,
  rarityName,
  themeName,
  ...containerProps
}: CardArtProps) {
  const theme = useOptionalTheme();
  const resolvedThemeName = themeName ?? theme?.themeName ?? "candy";
  const resolvedName = name ?? card?.name ?? "Unknown card";
  const resolvedCharacter = character ?? card?.character;
  const resolvedImageUrl = imageUrl ?? card?.imageUrl;
  const resolvedImageAssetId = imageAssetId ?? card?.imageAssetId;
  const resolvedRarityName =
    rarityName ?? normalizeCardRarityName(card?.rarity?.name);
  const source = resolvedImageUrl
    ? normalizeMediaUrl(resolvedImageUrl, { baseUrl: apiBaseUrl, kind: "card" })
    : resolvedImageAssetId
      ? getCardMediaUrl(resolvedImageAssetId, apiBaseUrl)
      : null;
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const showImage = Boolean(source && failedSource !== source);
  const resolvedAlt =
    alt ??
    (resolvedCharacter
      ? `${resolvedName} — ${resolvedCharacter}`
      : resolvedName);
  const outlineSource = getCardOutlineResponsiveSource(
    resolvedThemeName,
    resolvedRarityName,
  );

  return (
    <div
      {...containerProps}
      className={joinClassNames("game-card-art", className)}
    >
      {showImage ? (
        <img
          {...imageProps}
          alt={resolvedAlt}
          className={joinClassNames(
            "game-card-art__image",
            imageProps?.className,
          )}
          decoding={imageProps?.decoding ?? "async"}
          loading={imageProps?.loading ?? "lazy"}
          onError={(event) => {
            setFailedSource(source);
            imageProps?.onError?.(event);
          }}
          src={source ?? undefined}
        />
      ) : (
        <div
          aria-hidden={resolvedAlt ? undefined : true}
          aria-label={resolvedAlt || undefined}
          className="game-card-art__fallback"
          role={resolvedAlt ? "img" : undefined}
        >
          {resolvedName.trim().charAt(0).toUpperCase() || "?"}
        </div>
      )}

      {children ? (
        <div className="game-card-art__content">{children}</div>
      ) : null}

      <picture className="game-card-art__frame">
        <source srcSet={outlineSource.avifSrcSet} type="image/avif" />
        <img
          {...outlineProps}
          alt=""
          aria-hidden="true"
          className={joinClassNames(
            "game-card-art__frame-image",
            outlineProps?.className,
          )}
          decoding={outlineProps?.decoding ?? "async"}
          draggable={false}
          loading={outlineProps?.loading ?? "lazy"}
          src={outlineSource.fallback}
        />
      </picture>
    </div>
  );
}

export interface CardBackProps extends ManagedImageProps {
  alt?: string;
  apiBaseUrl?: string;
  imageAssetId?: string | null;
  rarityName: CardRarityName;
  themeName: ThemeName;
}

export function CardBack({
  alt,
  apiBaseUrl = "",
  className,
  imageAssetId,
  onError,
  rarityName,
  themeName,
  ...imageProps
}: CardBackProps) {
  const preferredSource = getCardBackSource(
    themeName,
    rarityName,
    imageAssetId,
    apiBaseUrl,
  );
  const bundledSource = getCardBackSource(themeName, rarityName);
  const bundledResponsiveSource = getBundledCardBackResponsiveSource(
    themeName,
    rarityName,
  );
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const source =
    failedSource === preferredSource ? bundledSource : preferredSource;

  return (
    <picture className="game-card-back-picture">
      {source === bundledSource ? (
        <source srcSet={bundledResponsiveSource.avifSrcSet} type="image/avif" />
      ) : null}
      <img
        {...imageProps}
        alt={alt ?? `${rarityName} card back`}
        className={joinClassNames("game-card-back", className)}
        decoding={imageProps.decoding ?? "async"}
        loading={imageProps.loading ?? "lazy"}
        onError={(event) => {
          if (source !== bundledSource) {
            setFailedSource(preferredSource);
          }
          onError?.(event);
        }}
        src={source}
      />
    </picture>
  );
}

export interface PackArtProps extends ManagedImageProps, Partial<PackArtInput> {
  alt?: string;
  apiBaseUrl?: string;
  pack?: PackArtInput;
}

export function PackArt({
  alt,
  apiBaseUrl = "",
  className,
  guaranteedRarity,
  name,
  onError,
  packArtAssetId,
  packArtUrl,
  pack,
  ...imageProps
}: PackArtProps) {
  const resolvedPack: PackArtInput = {
    guaranteedRarity: guaranteedRarity ?? pack?.guaranteedRarity,
    name: name ?? pack?.name ?? "Pack",
    packArtAssetId: packArtAssetId ?? pack?.packArtAssetId,
    packArtUrl: packArtUrl ?? pack?.packArtUrl,
  };
  const preferredSource = getPackArtSource(resolvedPack, apiBaseUrl);
  const bundledSource = getBundledPackArtSource(resolvedPack);
  const bundledResponsiveSource =
    getBundledPackArtResponsiveSource(resolvedPack);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const source =
    preferredSource && failedSource !== preferredSource
      ? preferredSource
      : bundledSource;

  return (
    <picture className="game-pack-art-picture">
      {source === bundledSource ? (
        <source srcSet={bundledResponsiveSource.avifSrcSet} type="image/avif" />
      ) : null}
      <img
        {...imageProps}
        alt={alt ?? `${resolvedPack.name} artwork`}
        className={joinClassNames("game-pack-art", className)}
        decoding={imageProps.decoding ?? "async"}
        loading={imageProps.loading ?? "lazy"}
        onError={(event) => {
          if (source !== bundledSource && preferredSource) {
            setFailedSource(preferredSource);
          }
          onError?.(event);
        }}
        src={source}
      />
    </picture>
  );
}

export interface AuthenticatedProfileImageProps extends ManagedImageProps {
  accessToken: string;
  alt: string;
  apiBaseUrl?: string;
  fallback?: ReactNode;
  imageAssetId: string | null | undefined;
}

export function AuthenticatedProfileImage({
  accessToken,
  alt,
  apiBaseUrl = "",
  className,
  fallback = null,
  imageAssetId,
  onError,
  ...imageProps
}: AuthenticatedProfileImageProps) {
  const [source, setSource] = useState<string | null>(null);
  const objectUrlRef = useRef<AuthenticatedProfileObjectUrl | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    objectUrlRef.current?.revoke();
    objectUrlRef.current = null;
    setSource(null);

    if (!imageAssetId || !accessToken) {
      return () => controller.abort();
    }

    void fetchAuthenticatedProfileObjectUrl({
      accessToken,
      baseUrl: apiBaseUrl,
      imageAssetId,
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) {
          result.revoke();
          return;
        }

        objectUrlRef.current = result;
        setSource(result.url);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setSource(null);
        }
      });

    return () => {
      controller.abort();
      objectUrlRef.current?.revoke();
      objectUrlRef.current = null;
    };
  }, [accessToken, apiBaseUrl, imageAssetId]);

  if (!source) {
    return <>{fallback}</>;
  }

  return (
    <img
      {...imageProps}
      alt={alt}
      className={joinClassNames("authenticated-profile-image", className)}
      decoding={imageProps.decoding ?? "async"}
      onError={(event) => {
        if (objectUrlRef.current?.url === source) {
          objectUrlRef.current.revoke();
          objectUrlRef.current = null;
        }
        setSource((currentSource) =>
          currentSource === source ? null : currentSource,
        );
        onError?.(event);
      }}
      src={source}
    />
  );
}

function joinClassNames(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ");
}
