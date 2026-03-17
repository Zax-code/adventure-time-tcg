import { memo, useEffect, useRef } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import type { CollectionResponse } from "@adventure-time/shared";
import { getCardImageCacheKey, getCardImageUrl } from "../lib/card-images";
import { CARD_TYPE_COLORS, RARITY_COLORS, SECONDARY_TINT } from "./theme";
import { HPIcon, SpeedIcon, RarityIcon } from "./icons";

type CollectionEntry = CollectionResponse["cards"][number];

interface CardTileProps {
  entry: CollectionEntry;
  accessToken?: string | null;
  onPress?: () => void;
  onRecycle?: () => void;
  onCraft?: () => void;
  size?: "small" | "large";
  fitContainer?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

const sizeConfig = {
  small: {
    width: 152, height: 240,
    paddingH: 6, paddingT: 4, paddingB: 2,
    headerFontSize: 8, hpIconSize: 30,
    nameFontSize: 9, charFontSize: 8,
    descFontSize: 7, descPadding: 4, descLineHeight: 10,
    speedHeight: 16, speedIconSize: 30,
    typeFontSize: 6, rarityFontSize: 5,
    borderRadius: 12,
    imageAspect: 152 / 96,
    headerHeight: 18,
    headerHpOffset: -15,
    headerHpTop: -2,
    descMarginTop: 3,
    descMinHeight: 28,
    nameMarginTop: 2,
    nameGap: 1,
    speedMarginTop: 2,
    speedIconTop: -12,
    typePaddingH: 6, typePaddingV: 2,
    rarityBadgeRadius: 4,
  },
  large: {
    width: 320, height: 480,
    paddingH: 16, paddingT: 8, paddingB: 4,
    headerFontSize: 16, hpIconSize: 60,
    nameFontSize: 18, charFontSize: 16,
    descFontSize: 12, descPadding: 16, descLineHeight: 20,
    speedHeight: 40, speedIconSize: 60,
    typeFontSize: 10, rarityFontSize: 9,
    borderRadius: 16,
    imageAspect: 320 / 192,
    headerHeight: 36,
    headerHpOffset: -30,
    headerHpTop: -4,
    descMarginTop: 6,
    descMinHeight: 56,
    nameMarginTop: 4,
    nameGap: 2,
    speedMarginTop: 4,
    speedIconTop: -24,
    typePaddingH: 12, typePaddingV: 4,
    rarityBadgeRadius: 8,
  },
};

const COMPACT_LABELS: Record<string, string> = {
  Common: "COM",
  Uncommon: "UNC",
  Rare: "RAR",
  Epic: "EPC",
  Legendary: "LGD",
};

function RarityCrest({ rarityName, cfg }: { rarityName: string; cfg: typeof sizeConfig.small }) {
  const rarity = RARITY_COLORS[rarityName] ?? RARITY_COLORS.Common;
  const label = COMPACT_LABELS[rarityName] ?? rarityName.slice(0, 3).toUpperCase();
  return (
    <LinearGradient
      colors={[rarity.from, rarity.to]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 2,
        paddingHorizontal: 4,
        paddingVertical: 1,
      }}
    >
      <RarityIcon rarityName={rarityName} size={cfg.rarityFontSize + 3} color="#fff" />
      <Text style={{ color: "#fff", fontSize: cfg.rarityFontSize, fontFamily: "Nunito_800ExtraBold" }}>
        {label}
      </Text>
    </LinearGradient>
  );
}

export const CardTile = memo(function CardTile({
  entry,
  accessToken: _accessToken,
  onPress,
  onRecycle,
  onCraft,
  size = "small",
  fitContainer = false,
  containerStyle,
}: CardTileProps) {
  const { card, quantity } = entry;
  const cfg = sizeConfig[size];
  const typeColor = CARD_TYPE_COLORS[card.type] ?? { frame: "#9CA3AF", light: "#F3F4F6", dark: "#374151" };
  const rarityColor = RARITY_COLORS[card.rarity.name] ?? { from: "#9CA3AF", to: "#6B7280", ring: "#9CA3AF" };

  const bounceAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (size !== "small" || quantity <= 1) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: -5, duration: 400, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 400, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [quantity, size]);

  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          width: fitContainer ? "100%" : cfg.width,
          margin: fitContainer ? 0 : size === "small" ? 4 : 0,
        },
        containerStyle,
      ]}
    >
      {/* Outer card: type-colored frame background */}
      <View
        style={{
          borderRadius: cfg.borderRadius,
          overflow: "hidden",
          backgroundColor: typeColor.frame,
          height: fitContainer ? undefined : cfg.height,
          aspectRatio: fitContainer ? cfg.width / cfg.height : undefined,
        }}
      >
        {/* Rarity ring overlay */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: cfg.borderRadius,
            borderWidth: 1,
            borderColor: rarityColor.ring,
            zIndex: 10,
          }}
        />

        {/* Inner content */}
        <View style={{ paddingHorizontal: cfg.paddingH, paddingTop: cfg.paddingT, paddingBottom: cfg.paddingB, flex: 1 }}>

          {/* === HEADER: ATK / HP / DEF === */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2, position: "relative", height: cfg.headerHeight }}>
            <Text style={{ flex: 1, textAlign: "center", color: "#fff", fontSize: cfg.headerFontSize, fontFamily: "Nunito_800ExtraBold" }}>
              {card.attack} ATK
            </Text>
            {/* HP floats center, slightly overlapping down */}
            <View style={{ position: "absolute", left: "50%", transform: [{ translateX: cfg.headerHpOffset }], top: cfg.headerHpTop, zIndex: 5 }}>
              <HPIcon size={cfg.hpIconSize} hpVal={card.hp} />
            </View>
            <Text style={{ flex: 1, textAlign: "center", color: "#fff", fontSize: cfg.headerFontSize, fontFamily: "Nunito_700Bold" }}>
              {card.defense} DEF
            </Text>
          </View>

          {/* === IMAGE SECTION === */}
          <View style={{ aspectRatio: cfg.imageAspect, borderRadius: cfg.rarityBadgeRadius, overflow: "hidden", position: "relative" }}>
            {card.imageAssetId ? (
              <Image
                source={{
                  uri: getCardImageUrl(card.imageAssetId),
                  cacheKey: getCardImageCacheKey(card.imageAssetId),
                }}
                placeholder={{ blurhash: "LKO2?U%2Tw=w]~RBVZRi};RPxuwH" }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={{ flex: 1, backgroundColor: typeColor.light, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: typeColor.dark, fontSize: cfg.nameFontSize * 2, fontFamily: "Nunito_800ExtraBold" }}>
                  {(card.character || card.name || "?").charAt(0)}
                </Text>
              </View>
            )}

            {/* Type badge — bottom right */}
            <View
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                backgroundColor: typeColor.dark,
                paddingHorizontal: cfg.typePaddingH,
                paddingVertical: cfg.typePaddingV,
                borderTopLeftRadius: cfg.rarityBadgeRadius / 2,
              }}
            >
              <Text style={{ color: "#fff", fontSize: cfg.typeFontSize, fontFamily: "Nunito_700Bold" }}>
                {card.type}
              </Text>
            </View>

            {/* Rarity crest — bottom left */}
            <View style={{ position: "absolute", bottom: 0, left: 0, borderTopRightRadius: cfg.rarityBadgeRadius / 2, overflow: "hidden" }}>
              <RarityCrest rarityName={card.rarity.name} cfg={cfg} />
            </View>

          </View>

          {/* === NAME & CHARACTER === */}
          <View style={{ alignItems: "center", marginTop: cfg.nameMarginTop, gap: cfg.nameGap }}>
            <Text
              style={{ color: "#fff", fontSize: cfg.nameFontSize, fontFamily: "Nunito_700Bold" }}
              numberOfLines={1}
            >
              {card.name}
            </Text>
            <Text
              style={{ color: "#fff", fontSize: cfg.charFontSize, fontFamily: "Nunito_600SemiBold", fontStyle: "italic" }}
              numberOfLines={1}
            >
              {card.character}
            </Text>
          </View>

          {/* === DESCRIPTION === */}
          <View
            style={{
              backgroundColor: SECONDARY_TINT,
              borderRadius: cfg.rarityBadgeRadius / 2,
              padding: cfg.descPadding,
              marginTop: cfg.descMarginTop,
              flex: 1,
              minHeight: cfg.descMinHeight,
            }}
          >
            <Text
              style={{ color: "#DB2777", fontSize: cfg.descFontSize, fontFamily: "Nunito_400Regular", lineHeight: cfg.descLineHeight }}
              numberOfLines={size === "large" ? 6 : 4}
            >
              {card.description}
            </Text>
          </View>

          {/* === SPEED SECTION === */}
          <View style={{ height: cfg.speedHeight, alignItems: "center", justifyContent: "center", position: "relative", marginTop: cfg.speedMarginTop }}>
            <View style={{ position: "absolute", top: cfg.speedIconTop }}>
              <SpeedIcon size={cfg.speedIconSize} speedVal={card.speed} />
            </View>
          </View>
        </View>
      </View>

      {/* Quantity badge below card — only for small size */}
      {size === "small" && (
        quantity > 1 ? (
          <Animated.View style={{ transform: [{ translateY: bounceAnim }], alignItems: "center", marginTop: 4 }}>
            <View
              style={{
                backgroundColor: rarityColor.ring,
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 2,
                width: 50,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 11, fontFamily: "Nunito_700Bold" }}>x{quantity}</Text>
            </View>
          </Animated.View>
        ) : (
          <View style={{ height: 20 }} />
        )
      )}

      {/* Action buttons below card */}
      {(onRecycle || onCraft) ? (
        <View style={{ flexDirection: "row", gap: 4, marginTop: 4 }}>
          {onRecycle ? (
            <Pressable
              onPress={onRecycle}
              style={{
                flex: 1,
                alignItems: "center",
                paddingVertical: 4,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: "#F9A8D4",
              }}
            >
              <Text style={{ fontSize: 10, color: "#DB2777", fontFamily: "Nunito_600SemiBold" }}>
                Recycle
              </Text>
            </Pressable>
          ) : null}
          {onCraft ? (
            <Pressable
              onPress={onCraft}
              style={{
                flex: 1,
                alignItems: "center",
                paddingVertical: 4,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: "#F9A8D4",
              }}
            >
              <Text style={{ fontSize: 10, color: "#DB2777", fontFamily: "Nunito_600SemiBold" }}>
                Craft
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
});
