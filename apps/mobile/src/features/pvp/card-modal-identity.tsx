import { useState } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";

import {
  RARITY_COLORS,
  RARITY_COLORS_ICE,
  RARITY_COLORS_NIGHTOSPHERE,
} from "../../components/theme";
import { useTranslation } from "../../i18n";
import {
  localizeRarityName,
  localizeTypeName,
} from "../../lib/combat-i18n";
import type { ThemeName } from "../../theme/themes";
import { getCardModalTypeColor } from "./card-modal-colors";
import { resolveBattleImageUrl } from "./image-url";
import type { PvpUnitState } from "./types";

type Rgb = { r: number; g: number; b: number };

function getRarityPalette(themeName: ThemeName) {
  if (themeName === "ice") {
    return RARITY_COLORS_ICE;
  }

  if (themeName === "nightosphere") {
    return RARITY_COLORS_NIGHTOSPHERE;
  }

  return RARITY_COLORS;
}

function parseHex(color: string): Rgb | null {
  const normalized = color.replace("#", "");

  if (normalized.length !== 6 && normalized.length !== 8) {
    return null;
  }

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function luminance({ r, g, b }: Rgb) {
  const channels = [r, g, b].map((value) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(a: string, b: string) {
  const rgbA = parseHex(a);
  const rgbB = parseHex(b);

  if (!rgbA || !rgbB) {
    return 1;
  }

  const light = Math.max(luminance(rgbA), luminance(rgbB));
  const dark = Math.min(luminance(rgbA), luminance(rgbB));

  return (light + 0.05) / (dark + 0.05);
}

function readableTextColor(background: string) {
  return contrastRatio(background, "#111827") >=
    contrastRatio(background, "#FFFFFF")
    ? "#111827"
    : "#FFFFFF";
}

interface CardModalIdentityProps {
  unit: PvpUnitState;
  themeName: ThemeName;
}

export function CardModalIdentity({
  unit,
  themeName,
}: CardModalIdentityProps) {
  const { t } = useTranslation();
  const rarityPalette = getRarityPalette(themeName);
  const typeColor = getCardModalTypeColor(unit, themeName);
  const rarityColor = rarityPalette[unit.rarity] ?? rarityPalette.Common;
  const typeBackground = typeColor.dark;
  const typeText = readableTextColor(typeBackground);
  const rarityBackground = rarityColor.ring;
  const rarityText = readableTextColor(rarityBackground);
  const imageUrl = resolveBattleImageUrl(unit.imageUrl);
  const characterLabel =
    unit.character && unit.character !== unit.name ? unit.character : null;

  return (
    <View
      className="overflow-hidden"
      style={{ backgroundColor: typeBackground }}
    >
      <CardModalArtwork
        key={imageUrl ?? `fallback-${unit.instanceId}`}
        imageUrl={imageUrl}
        fallbackLabel={unit.name.charAt(0)}
        backgroundColor={typeColor.light}
      />

      <View
        className="gap-0.5 px-5 py-2"
        style={{
          backgroundColor: typeBackground,
          borderTopColor: typeColor.frame,
          borderTopWidth: 4,
        }}
      >
        <View className="flex-row items-center justify-between gap-3">
          <Text
            className="font-nunito-extrabold text-xs uppercase"
            numberOfLines={1}
            style={{ color: typeText }}
          >
            {localizeTypeName(unit.type, t)}
          </Text>
          <View
            className="rounded-full px-3 py-1"
            style={{ backgroundColor: rarityBackground }}
          >
            <Text
              className="font-nunito-extrabold text-[11px] uppercase"
              numberOfLines={1}
              style={{ color: rarityText }}
            >
              {localizeRarityName(unit.rarity, t)}
            </Text>
          </View>
        </View>

        <Text
          className="font-nunito-extrabold text-lg"
          numberOfLines={1}
          style={{ color: typeText }}
        >
          {unit.name}
        </Text>
        {characterLabel ? (
          <Text
            className="font-nunito-bold text-xs"
            numberOfLines={1}
            style={{ color: typeText, opacity: 0.82 }}
          >
            {characterLabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function CardModalArtwork({
  imageUrl,
  fallbackLabel,
  backgroundColor,
}: {
  imageUrl: string | null;
  fallbackLabel: string;
  backgroundColor: string;
}) {
  const [imageAspectRatio, setImageAspectRatio] = useState(1);

  return (
    <View
      style={{
        width: "100%",
        aspectRatio: imageAspectRatio,
        backgroundColor,
      }}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: "100%", height: "100%" }}
          contentFit="contain"
          onLoad={({ source }) => {
            if (source.width > 0 && source.height > 0) {
              setImageAspectRatio(source.width / source.height);
            }
          }}
        />
      ) : (
        <View
          className="h-full w-full items-center justify-center"
          style={{ backgroundColor }}
        >
          <Text className="font-nunito-extrabold text-7xl text-white">
            {fallbackLabel}
          </Text>
        </View>
      )}
    </View>
  );
}
