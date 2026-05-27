import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";

import type { AdminCardDetail, AdminCardsResponse } from "@adventure-time/api-client";

import { getCardImageCacheKey, getCardImageUrl } from "../../lib/card-images";

type AdminCard = AdminCardsResponse["cards"][number] | AdminCardDetail;

const SIZE_CONFIG = {
  small: {
    width: 152,
    height: 240,
    titleSize: 13,
    bodySize: 10,
    statSize: 11,
    badgeSize: 10,
  },
  large: {
    width: 320,
    height: 480,
    titleSize: 22,
    bodySize: 14,
    statSize: 15,
    badgeSize: 12,
  },
} as const;

const RARITY_COLORS: Record<string, string> = {
  Common: "#94A3B8",
  Uncommon: "#22C55E",
  Rare: "#3B82F6",
  Epic: "#A855F7",
  Legendary: "#F59E0B",
};

export const AdminCardTile = memo(
  function AdminCardTile({
    card,
    onPress,
    size = "small",
    fitContainer = false,
  }: {
    card: AdminCard;
    onPress?: () => void;
    size?: "small" | "large";
    fitContainer?: boolean;
  }) {
    const cfg = SIZE_CONFIG[size];
    const rarityColor = RARITY_COLORS[card.rarityName] ?? "#64748B";

    return (
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        className="overflow-hidden rounded-[18px] border bg-surface"
        style={{
          width: fitContainer ? "100%" : cfg.width,
          height: fitContainer ? undefined : cfg.height,
          aspectRatio: fitContainer ? cfg.width / cfg.height : undefined,
          borderColor: card.isArchived ? "rgba(148, 163, 184, 0.45)" : rarityColor,
          opacity: onPress ? 1 : 0.98,
        }}
      >
        <View className="flex-1">
          <View
            className="px-3 py-2 border-b bg-surfaceMuted"
            style={{ borderBottomColor: "rgba(148, 163, 184, 0.2)" }}
          >
            <View className="flex-row items-start justify-between gap-2">
              <View className="flex-1">
                <Text
                  className="font-nunito-extrabold text-primaryStrong"
                  numberOfLines={1}
                  style={{ fontSize: cfg.titleSize }}
                >
                  {card.name}
                </Text>
                <Text
                  className="mt-1 font-nunito-semibold italic text-fgMuted"
                  numberOfLines={1}
                  style={{ fontSize: cfg.bodySize }}
                >
                  {card.character}
                </Text>
              </View>

              <View
                className="rounded-full px-2 py-1"
                style={{ backgroundColor: rarityColor }}
              >
                <Text
                  className="font-nunito-extrabold text-white"
                  style={{ fontSize: cfg.badgeSize }}
                >
                  {card.rarityName}
                </Text>
              </View>
            </View>
          </View>

          <View className="px-3 pt-3">
            <View className="overflow-hidden rounded-2xl border border-primaryBorder/20 bg-surfaceMuted">
              {card.imageAssetId ? (
                <Image
                  source={{
                    uri: getCardImageUrl(card.imageAssetId),
                    cacheKey: getCardImageCacheKey(card.imageAssetId),
                  }}
                  style={{ width: "100%", aspectRatio: 1.55 }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <View
                  className="items-center justify-center bg-primaryTint/40"
                  style={{ width: "100%", aspectRatio: 1.55 }}
                >
                  <Text
                    className="font-nunito-extrabold text-primaryText"
                    style={{ fontSize: size === "large" ? 56 : 32 }}
                  >
                    {(card.character || card.name || "?").charAt(0)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View className="px-3 pt-3">
            <View className="flex-row gap-2">
              {[
                { label: "HP", value: card.hp },
                { label: "ATK", value: card.attack },
                { label: "DEF", value: card.defense },
                { label: "SPD", value: card.speed },
              ].map((stat) => (
                <View key={stat.label} className="flex-1 rounded-xl bg-primaryTint/45 px-2 py-2 items-center">
                  <Text className="font-nunito-extrabold text-primaryStrong" style={{ fontSize: cfg.statSize }}>
                    {stat.value}
                  </Text>
                  <Text className="mt-1 font-nunito-bold text-fgMuted" style={{ fontSize: cfg.badgeSize }}>
                    {stat.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View className="flex-1 px-3 pb-3 pt-3" style={{ minHeight: size === "large" ? 116 : 74 }}>
            <View className="flex-row items-center justify-between gap-2">
              <View className="rounded-full bg-primaryText px-3 py-1">
                <Text className="font-nunito-extrabold text-white" style={{ fontSize: cfg.badgeSize }}>
                  {card.type}
                </Text>
              </View>
              {card.isArchived ? (
                <View className="rounded-full bg-dangerTint px-3 py-1">
                  <Text className="font-nunito-extrabold text-dangerText" style={{ fontSize: cfg.badgeSize }}>
                    Archived
                  </Text>
                </View>
              ) : null}
            </View>

            <Text
              className="mt-3 flex-1 font-nunito text-fg"
              numberOfLines={size === "large" ? 5 : 4}
              style={{ fontSize: cfg.bodySize, lineHeight: size === "large" ? 20 : 14 }}
            >
              {card.description}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  },
  (prev, next) =>
    prev.card.id === next.card.id &&
    prev.card.name === next.card.name &&
    prev.card.character === next.card.character &&
    prev.card.description === next.card.description &&
    prev.card.hp === next.card.hp &&
    prev.card.attack === next.card.attack &&
    prev.card.defense === next.card.defense &&
    prev.card.speed === next.card.speed &&
    prev.card.type === next.card.type &&
    prev.card.rarityId === next.card.rarityId &&
    prev.card.rarityName === next.card.rarityName &&
    prev.card.imageAssetId === next.card.imageAssetId &&
    prev.card.isArchived === next.card.isArchived &&
    prev.size === next.size &&
    prev.fitContainer === next.fitContainer &&
    prev.onPress === next.onPress,
);
