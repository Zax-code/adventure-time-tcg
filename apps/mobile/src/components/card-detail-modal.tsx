import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

import type { CollectionResponse } from "@adventure-time/shared";
import { getDustCraftCost, getDustSacrificeValue } from "../lib/dust";
import { CardTile } from "./card-tile";
import { SECONDARY_TINT } from "./theme";

type CollectionEntry = CollectionResponse["cards"][number];

interface CardDetailModalProps {
  entry: CollectionEntry | null;
  dust: number;
  onClose: () => void;
  onRecycle: (cardId: string, quantity: number) => Promise<{ success: boolean; error?: string }>;
  onCraft: (cardId: string) => Promise<{ success: boolean; error?: string }>;
  accessToken?: string | null;
}

export function CardDetailModal({ entry, dust, onClose, onRecycle, onCraft, accessToken }: CardDetailModalProps) {
  const [recycleExpanded, setRecycleExpanded] = useState(false);
  const [recycleQuantity, setRecycleQuantity] = useState(1);
  const [recycleError, setRecycleError] = useState("");
  const [craftError, setCraftError] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (entry) {
      setRecycleExpanded(false);
      setRecycleQuantity(1);
      setRecycleError("");
      setCraftError("");
      setIsBusy(false);
    }
  }, [entry?.id]);

  const handleRecycle = async () => {
    if (!entry) return;
    setIsBusy(true);
    setRecycleError("");
    const result = await onRecycle(entry.cardId, recycleQuantity);
    setIsBusy(false);
    if (result.success) {
      onClose();
    } else {
      setRecycleError(result.error ?? "Recycle failed");
    }
  };

  const handleCraft = async () => {
    if (!entry) return;
    setIsBusy(true);
    setCraftError("");
    const result = await onCraft(entry.cardId);
    setIsBusy(false);
    if (result.success) {
      onClose();
    } else {
      setCraftError(result.error ?? "Craft failed");
    }
  };

  return (
    <Modal
      visible={!!entry}
      transparent
      animationType="fade"
      onRequestClose={() => { if (!isBusy) onClose(); }}
    >
      {entry ? (
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" }}
          onPress={() => { if (!isBusy) onClose(); }}
        >
          <View
            style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "85%" }}
            onStartShouldSetResponder={() => true}
          >
            <ScrollView
              contentContainerStyle={{ paddingTop: 16, paddingBottom: 32, paddingHorizontal: 16, alignItems: "center" }}
              showsVerticalScrollIndicator={false}
            >
              {/* Card tile */}
              <View style={{ marginTop: 8, marginBottom: 16 }}>
                <CardTile entry={entry} accessToken={accessToken} />
              </View>

              {/* Rarity info row */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, width: "100%" }}>
                <Text style={{ fontSize: 16, fontFamily: "Nunito_700Bold", color: entry.card.rarity.color }}>
                  {entry.card.rarity.name}
                </Text>
                <View style={{ backgroundColor: "#F3F4F6", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 11, fontFamily: "Nunito_600SemiBold", color: "#6B7280" }}>RARITY</Text>
                </View>
              </View>

              {/* Stats row */}
              <View style={{ flexDirection: "row", width: "100%", marginBottom: 16, gap: 8 }}>
                {[
                  { label: "HP", value: entry.card.hp, color: "#DB2777" },
                  { label: "ATK", value: entry.card.attack, color: "#DB2777" },
                  { label: "DEF", value: entry.card.defense, color: "#3B82F6" },
                  { label: "SPD", value: entry.card.speed, color: "#10B981" },
                ].map(({ label, value, color }) => (
                  <View key={label} style={{ flex: 1, alignItems: "center", backgroundColor: "#F9FAFB", borderRadius: 8, paddingVertical: 10 }}>
                    <Text style={{ fontSize: 18, fontFamily: "Nunito_700Bold", color }}>{value}</Text>
                    <Text style={{ fontSize: 10, fontFamily: "Nunito_600SemiBold", color: "#6B7280", textTransform: "uppercase" }}>{label}</Text>
                  </View>
                ))}
              </View>

              {/* Recycle section */}
              <View style={{ width: "100%", backgroundColor: "#ECFDF5", borderRadius: 12, marginBottom: 12, overflow: "hidden" }}>
                <Pressable
                  style={{ flexDirection: "row", alignItems: "center", padding: 12, gap: 8 }}
                  onPress={() => setRecycleExpanded(!recycleExpanded)}
                >
                  <Text style={{ fontSize: 16 }}>♻️</Text>
                  <Text style={{ flex: 1, fontSize: 14, fontFamily: "Nunito_700Bold", color: "#065F46" }}>Recycle</Text>
                  <View style={{ backgroundColor: "#D1FAE5", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 12, fontFamily: "Nunito_600SemiBold", color: "#065F46" }}>
                      +{getDustSacrificeValue(entry.card.rarity.name)} ✨
                    </Text>
                  </View>
                  <Text style={{ color: "#065F46", fontSize: 12 }}>{recycleExpanded ? "▲" : "▼"}</Text>
                </Pressable>

                {recycleExpanded && (
                  <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
                    {entry.quantity > 1 && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12, justifyContent: "center" }}>
                        <Pressable
                          onPress={() => setRecycleQuantity(Math.max(1, recycleQuantity - 1))}
                          style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#D1FAE5", alignItems: "center", justifyContent: "center" }}
                        >
                          <Text style={{ color: "#065F46", fontFamily: "Nunito_700Bold", fontSize: 18 }}>−</Text>
                        </Pressable>
                        <Text style={{ fontSize: 15, fontFamily: "Nunito_700Bold", color: "#065F46", minWidth: 80, textAlign: "center" }}>
                          {recycleQuantity}  (+{getDustSacrificeValue(entry.card.rarity.name) * recycleQuantity} ✨)
                        </Text>
                        <Pressable
                          onPress={() => setRecycleQuantity(Math.min(entry.quantity, recycleQuantity + 1))}
                          style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#D1FAE5", alignItems: "center", justifyContent: "center" }}
                        >
                          <Text style={{ color: "#065F46", fontFamily: "Nunito_700Bold", fontSize: 18 }}>+</Text>
                        </Pressable>
                      </View>
                    )}
                    <Pressable
                      onPress={handleRecycle}
                      disabled={isBusy}
                      style={{ backgroundColor: "#059669", borderRadius: 8, paddingVertical: 10, alignItems: "center", opacity: isBusy ? 0.6 : 1 }}
                    >
                      <Text style={{ color: "#fff", fontFamily: "Nunito_700Bold", fontSize: 14 }}>
                        {isBusy ? "Recycling..." : `Confirm Recycle (+${getDustSacrificeValue(entry.card.rarity.name) * recycleQuantity} ✨)`}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {/* Craft button */}
              <Pressable
                onPress={handleCraft}
                disabled={isBusy || dust < getDustCraftCost(entry.card.rarity.name)}
                style={{
                  width: "100%",
                  backgroundColor: SECONDARY_TINT,
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: "center",
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: "#F9A8D4",
                  opacity: isBusy || dust < getDustCraftCost(entry.card.rarity.name) ? 0.5 : 1,
                }}
              >
                <Text style={{ fontSize: 14, fontFamily: "Nunito_700Bold", color: "#DB2777" }}>
                  Craft  −{getDustCraftCost(entry.card.rarity.name)} ✨
                </Text>
              </Pressable>

              {/* Errors */}
              {(recycleError || craftError) ? (
                <Text style={{ color: "#DC2626", fontFamily: "Nunito_400Regular", fontSize: 12, marginBottom: 8, textAlign: "center" }}>
                  {recycleError || craftError}
                </Text>
              ) : null}

              {/* Close button */}
              <Pressable
                onPress={() => { if (!isBusy) onClose(); }}
                style={{ width: "100%", borderRadius: 12, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB" }}
              >
                <Text style={{ fontFamily: "Nunito_600SemiBold", color: "#6B7280", fontSize: 14 }}>Close</Text>
              </Pressable>
            </ScrollView>
          </View>
        </Pressable>
      ) : null}
    </Modal>
  );
}
