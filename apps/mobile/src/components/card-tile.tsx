import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import type { CollectionResponse } from "@adventure-time/shared";
import { API_BASE_URL } from "../lib/api";
import { CARD_TYPE_COLORS, RARITY_COLORS, SECONDARY_TINT } from "./theme";
import { HPIcon, SpeedIcon, RarityIcon } from "./icons";

type CollectionEntry = CollectionResponse["cards"][number];

interface CardTileProps {
  entry: CollectionEntry;
  accessToken?: string | null;
  onPress?: () => void;
  onRecycle?: () => void;
  onCraft?: () => void;
}

const COMPACT_LABELS: Record<string, string> = {
  Common: "COM",
  Uncommon: "UNC",
  Rare: "RAR",
  Epic: "EPC",
  Legendary: "LGD",
};

function RarityCrest({ rarityName }: { rarityName: string }) {
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
      <RarityIcon rarityName={rarityName} size={8} color="#fff" />
      <Text style={{ color: "#fff", fontSize: 5, fontFamily: "Nunito_800ExtraBold" }}>
        {label}
      </Text>
    </LinearGradient>
  );
}

export function CardTile({ entry, accessToken, onPress, onRecycle, onCraft }: CardTileProps) {
  const { card, quantity } = entry;
  const typeColor = CARD_TYPE_COLORS[card.type] ?? { frame: "#9CA3AF", light: "#F3F4F6", dark: "#374151" };
  const rarityColor = RARITY_COLORS[card.rarity.name] ?? { from: "#9CA3AF", to: "#6B7280", ring: "#9CA3AF" };

  return (
    <Pressable onPress={onPress} style={{ flex: 1, margin: 4 }}>
      {/* Outer card: type-colored frame background */}
      <View
        style={{
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: typeColor.frame,
        }}
      >
        {/* Rarity ring overlay */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: rarityColor.ring,
            zIndex: 10,
          }}
        />

        {/* Inner content */}
        <View style={{ paddingHorizontal: 6, paddingTop: 4, paddingBottom: 2, flex: 1 }}>

          {/* === HEADER: ATK / HP / DEF === */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2, position: "relative", height: 18 }}>
            <Text style={{ flex: 1, textAlign: "center", color: "#fff", fontSize: 8, fontFamily: "Nunito_800ExtraBold" }}>
              {card.attack} ATK
            </Text>
            {/* HP floats center, slightly overlapping down */}
            <View style={{ position: "absolute", left: "50%", transform: [{ translateX: -15 }], top: -2, zIndex: 5 }}>
              <HPIcon size={30} hpVal={card.hp} />
            </View>
            <Text style={{ flex: 1, textAlign: "center", color: "#fff", fontSize: 8, fontFamily: "Nunito_700Bold" }}>
              {card.defense} DEF
            </Text>
          </View>

          {/* === IMAGE SECTION === */}
          <View style={{ aspectRatio: 152 / 96, borderRadius: 6, overflow: "hidden", position: "relative" }}>
            {card.imageAssetId ? (
              <Image
                source={{
                  uri: `${API_BASE_URL}/media/card/${card.imageAssetId}`,
                  headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
                }}
                placeholder={{ blurhash: "LKO2?U%2Tw=w]~RBVZRi};RPxuwH" }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
              />
            ) : (
              <View style={{ flex: 1, backgroundColor: typeColor.light, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: typeColor.dark, fontSize: 18, fontFamily: "Nunito_800ExtraBold" }}>
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
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderTopLeftRadius: 4,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 6, fontFamily: "Nunito_700Bold" }}>
                {card.type}
              </Text>
            </View>

            {/* Rarity crest — bottom left */}
            <View style={{ position: "absolute", bottom: 0, left: 0, borderTopRightRadius: 4, overflow: "hidden" }}>
              <RarityCrest rarityName={card.rarity.name} />
            </View>

            {/* Quantity badge — top right */}
            {quantity > 1 ? (
              <View
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  backgroundColor: typeColor.frame,
                  borderRadius: 999,
                  paddingHorizontal: 5,
                  paddingVertical: 1,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 9, fontFamily: "Nunito_700Bold" }}>
                  x{quantity}
                </Text>
              </View>
            ) : null}
          </View>

          {/* === NAME & CHARACTER === */}
          <View style={{ alignItems: "center", marginTop: 2, gap: 1 }}>
            <Text
              style={{ color: "#fff", fontSize: 9, fontFamily: "Nunito_700Bold" }}
              numberOfLines={1}
            >
              {card.name}
            </Text>
            <Text
              style={{ color: "#fff", fontSize: 8, fontFamily: "Nunito_600SemiBold", fontStyle: "italic" }}
              numberOfLines={1}
            >
              {card.character}
            </Text>
          </View>

          {/* === DESCRIPTION === */}
          <View
            style={{
              backgroundColor: SECONDARY_TINT,
              borderRadius: 6,
              padding: 4,
              marginTop: 3,
              flex: 1,
              minHeight: 28,
            }}
          >
            <Text
              style={{ color: "#DB2777", fontSize: 7, fontFamily: "Nunito_400Regular", lineHeight: 10 }}
              numberOfLines={4}
            >
              {card.description}
            </Text>
          </View>

          {/* === SPEED SECTION === */}
          <View style={{ height: 16, alignItems: "center", justifyContent: "center", position: "relative", marginTop: 2 }}>
            <View style={{ position: "absolute", top: -12 }}>
              <SpeedIcon size={30} speedVal={card.speed} />
            </View>
          </View>
        </View>
      </View>

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
}
