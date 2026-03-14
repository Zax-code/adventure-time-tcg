import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";

import type { CollectionResponse } from "@adventure-time/shared";
import { API_BASE_URL } from "../lib/api";
import { CARD_TYPE_COLORS, RARITY_COLORS } from "./theme";

type CollectionEntry = CollectionResponse["cards"][number];

interface CardTileProps {
  entry: CollectionEntry;
  accessToken?: string | null;
  onPress?: () => void;
  onRecycle?: () => void;
  onCraft?: () => void;
}

export function CardTile({ entry, accessToken, onPress, onRecycle, onCraft }: CardTileProps) {
  const { card, quantity } = entry;
  const typeColor = CARD_TYPE_COLORS[card.type] ?? { frame: "#9CA3AF", light: "#F3F4F6", dark: "#374151" };
  const rarityColor = RARITY_COLORS[card.rarity.name] ?? { from: "#9CA3AF", to: "#6B7280", ring: "#9CA3AF" };

  return (
    <Pressable onPress={onPress} style={{ flex: 1, margin: 4 }}>
      <View
        style={{
          borderRadius: 16,
          borderWidth: 3,
          borderColor: typeColor.frame,
          backgroundColor: "#fff",
          overflow: "hidden",
        }}
      >
        {/* Card image */}
        <View style={{ position: "relative" }}>
          {card.imageAssetId ? (
            <Image
              source={{
                uri: `${API_BASE_URL}/media/card/${card.imageAssetId}`,
                headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
              }}
              placeholder={{ blurhash: "LKO2?U%2Tw=w]~RBVZRi};RPxuwH" }}
              style={{ width: "100%", aspectRatio: 3 / 4 }}
              contentFit="cover"
            />
          ) : (
            <View
              style={{
                width: "100%",
                aspectRatio: 3 / 4,
                backgroundColor: typeColor.light,
              }}
            />
          )}
          {/* Quantity badge */}
          {quantity > 1 ? (
            <View
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                backgroundColor: typeColor.frame,
                borderRadius: 999,
                paddingHorizontal: 7,
                paddingVertical: 2,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 11, fontFamily: "Nunito_700Bold" }}>
                x{quantity}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Card info */}
        <View style={{ padding: 8, gap: 3 }}>
          <Text
            style={{ fontFamily: "Nunito_700Bold", fontSize: 13, color: "#4a3728" }}
            numberOfLines={1}
          >
            {card.name}
          </Text>
          <Text style={{ fontFamily: "Nunito_400Regular", fontSize: 11, color: "#6b7280" }} numberOfLines={1}>
            {card.character}
          </Text>

          {/* Stats */}
          <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
            <Text style={{ fontSize: 11, color: rarityColor.ring, fontFamily: "Nunito_600SemiBold" }}>
              ❤️{card.hp}
            </Text>
            <Text style={{ fontSize: 11, color: rarityColor.ring, fontFamily: "Nunito_600SemiBold" }}>
              ⚔️{card.attack}
            </Text>
            <Text style={{ fontSize: 11, color: rarityColor.ring, fontFamily: "Nunito_600SemiBold" }}>
              🛡️{card.defense}
            </Text>
          </View>

          {/* Rarity badge */}
          <View
            style={{
              alignSelf: "flex-start",
              backgroundColor: rarityColor.from,
              borderRadius: 999,
              paddingHorizontal: 8,
              paddingVertical: 2,
              marginTop: 2,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 10, fontFamily: "Nunito_600SemiBold" }}>
              {card.rarity.name}
            </Text>
          </View>

          {/* Actions */}
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
        </View>
      </View>
    </Pressable>
  );
}
