import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import type { CollectionResponse } from "@adventure-time/shared";
import { getDustCraftCost, getDustSacrificeValue } from "../lib/dust";
import { useTranslation } from "../i18n";
import { CardTile } from "./card-tile";
import { RARITY_COLORS } from "./theme";
import { CraftIcon, RecycleIcon } from "./icons";

type CollectionEntry = CollectionResponse["cards"][number];

interface CardDetailModalProps {
  entry: CollectionEntry | null;
  dust: number;
  onClose: () => void;
  onRecycle: (
    cardId: string,
    quantity: number,
  ) => Promise<{ success: boolean; error?: string }>;
  onCraft: (cardId: string) => Promise<{ success: boolean; error?: string }>;
  accessToken?: string | null;
}

export function CardDetailModal({
  entry,
  dust,
  onClose,
  onRecycle,
  onCraft,
  accessToken,
}: CardDetailModalProps) {
  const { t } = useTranslation();
  const [recycleExpanded, setRecycleExpanded] = useState(false);
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [recycleQuantity, setRecycleQuantity] = useState(1);
  const [recycleError, setRecycleError] = useState("");
  const [craftError, setCraftError] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (entry) {
      setRecycleExpanded(false);
      setStatsExpanded(false);
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
      setRecycleError(result.error ?? t("native.cardDetail.recycleFailed"));
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
      setCraftError(result.error ?? t("native.cardDetail.craftFailed"));
    }
  };

  return (
    <Modal
      visible={!!entry}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!isBusy) onClose();
      }}
    >
      {entry ? (
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.75)" }}
          onPress={() => {
            if (!isBusy) onClose();
          }}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              alignItems: "center",
              paddingVertical: 32,
              paddingHorizontal: 16,
              gap: 16,
            }}
            showsVerticalScrollIndicator={false}
          >
            <View
              onStartShouldSetResponder={() => true}
              style={{ width: "100%", alignItems: "center", gap: 14 }}
            >
              {/* Large card floats on dark background */}
              <View style={{ marginTop: 8 }}>
                <CardTile
                  entry={entry}
                  size="large"
                  accessToken={accessToken}
                />
              </View>

              {/* Rarity panel — pink-bordered */}
              {(() => {
                const rarityColor =
                  RARITY_COLORS[entry.card.rarity.name] ?? RARITY_COLORS.Common;
                return (
                  <View
                    style={{
                      width: "100%",
                      backgroundColor: "#fff",
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: "#FCE7F3",
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      shadowColor: "#000",
                      shadowOpacity: 0.08,
                      shadowRadius: 6,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontFamily: "Nunito_600SemiBold",
                        color: "#9CA3AF",
                        textTransform: "uppercase",
                        letterSpacing: 1,
                      }}
                    >
                      {t("native.cardDetail.rarity")}
                    </Text>
                    <LinearGradient
                      colors={[rarityColor.from, rarityColor.to]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingHorizontal: 12,
                        paddingVertical: 5,
                        borderRadius: 999,
                      }}
                    >
                      <Text
                        style={{
                          color: "#fff",
                          fontFamily: "Nunito_800ExtraBold",
                          fontSize: 12,
                        }}
                      >
                        {entry.card.rarity.name.toUpperCase()}
                      </Text>
                    </LinearGradient>
                  </View>
                );
              })()}

              {/* Stats panel — collapsible */}
              <View
                style={{
                  width: "100%",
                  backgroundColor: "#fff",
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: "#FCE7F3",
                  shadowColor: "#000",
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  overflow: "hidden",
                }}
              >
                <Pressable
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    gap: 8,
                  }}
                  onPress={() => setStatsExpanded(!statsExpanded)}
                >
                  <Text style={{ fontSize: 16 }}>⚔️</Text>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 14,
                      fontFamily: "Nunito_700Bold",
                      color: "#1F2937",
                    }}
                  >
                    {t("native.cardDetail.stats")}
                  </Text>
                  <Text style={{ color: "#DB2777", fontSize: 14 }}>
                    {statsExpanded ? "▲" : "▼"}
                  </Text>
                </Pressable>

                {statsExpanded && (
                  <View
                    style={{
                      flexDirection: "row",
                      paddingHorizontal: 12,
                      paddingBottom: 14,
                      gap: 8,
                    }}
                  >
                    {[
                      { label: "HP", value: entry.card.hp, color: "#FB7185" },
                      {
                        label: "ATK",
                        value: entry.card.attack,
                        color: "#FBBF24",
                      },
                      {
                        label: "DEF",
                        value: entry.card.defense,
                        color: "#818CF8",
                      },
                      {
                        label: "SPD",
                        value: entry.card.speed,
                        color: "#2DD4BF",
                      },
                    ].map(({ label, value, color }) => (
                      <View
                        key={label}
                        style={{
                          flex: 1,
                          alignItems: "center",
                          backgroundColor: "#F9FAFB",
                          borderRadius: 10,
                          paddingVertical: 10,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 18,
                            fontFamily: "Nunito_800ExtraBold",
                            color,
                          }}
                        >
                          {value}
                        </Text>
                        <Text
                          style={{
                            fontSize: 10,
                            fontFamily: "Nunito_600SemiBold",
                            color: "#6B7280",
                            textTransform: "uppercase",
                          }}
                        >
                          {label}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Recycle section */}
              <View
                style={{
                  width: "100%",
                  backgroundColor: "#ECFDF5",
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: "#6EE7B7",
                  shadowColor: "#000",
                  shadowOpacity: 0.12,
                  shadowRadius: 8,
                  overflow: "hidden",
                }}
              >
                <Pressable
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 12,
                    gap: 8,
                  }}
                  onPress={() => setRecycleExpanded(!recycleExpanded)}
                >
                  <RecycleIcon size={18} color="#065F46" />
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 14,
                      fontFamily: "Nunito_700Bold",
                      color: "#065F46",
                    }}
                  >
                    {t("native.cardDetail.recycle")}
                  </Text>
                  <View
                    style={{
                      backgroundColor: "#D1FAE5",
                      borderRadius: 999,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: "Nunito_600SemiBold",
                        color: "#065F46",
                      }}
                    >
                      +{getDustSacrificeValue(entry.card.rarity.name)} ✨
                    </Text>
                  </View>
                  <Text style={{ color: "#065F46", fontSize: 12 }}>
                    {recycleExpanded ? "▲" : "▼"}
                  </Text>
                </Pressable>

                {recycleExpanded && (
                  <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
                    {entry.quantity > 1 && (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 12,
                          marginBottom: 12,
                          justifyContent: "center",
                        }}
                      >
                        <Pressable
                          onPress={() =>
                            setRecycleQuantity(Math.max(1, recycleQuantity - 1))
                          }
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: "#D1FAE5",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{
                              color: "#065F46",
                              fontFamily: "Nunito_700Bold",
                              fontSize: 18,
                            }}
                          >
                            −
                          </Text>
                        </Pressable>
                        <Text
                          style={{
                            fontSize: 15,
                            fontFamily: "Nunito_700Bold",
                            color: "#065F46",
                            minWidth: 80,
                            textAlign: "center",
                          }}
                        >
                          {recycleQuantity} (+
                          {getDustSacrificeValue(entry.card.rarity.name) *
                            recycleQuantity}{" "}
                          ✨)
                        </Text>
                        <Pressable
                          onPress={() =>
                            setRecycleQuantity(
                              Math.min(entry.quantity, recycleQuantity + 1),
                            )
                          }
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: "#D1FAE5",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{
                              color: "#065F46",
                              fontFamily: "Nunito_700Bold",
                              fontSize: 18,
                            }}
                          >
                            +
                          </Text>
                        </Pressable>
                      </View>
                    )}
                    <Pressable
                      onPress={handleRecycle}
                      disabled={isBusy}
                      style={{
                        backgroundColor: "#059669",
                        borderRadius: 8,
                        paddingVertical: 10,
                        alignItems: "center",
                        opacity: isBusy ? 0.6 : 1,
                      }}
                    >
                      <Text
                        style={{
                          color: "#fff",
                          fontFamily: "Nunito_700Bold",
                          fontSize: 14,
                        }}
                      >
                        {isBusy
                          ? t("native.cardDetail.recycling")
                          : t("native.cardDetail.confirmRecycle", {
                              amount:
                                getDustSacrificeValue(entry.card.rarity.name) *
                                recycleQuantity,
                            })}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {/* Craft button */}
              <Pressable
                onPress={handleCraft}
                disabled={
                  isBusy || dust < getDustCraftCost(entry.card.rarity.name)
                }
                style={{
                  width: "100%",
                  backgroundColor: "#FEF9C3",
                  borderRadius: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  borderWidth: 1,
                  borderColor: "#FDE047",
                  opacity:
                    isBusy || dust < getDustCraftCost(entry.card.rarity.name)
                      ? 0.5
                      : 1,
                }}
              >
                <CraftIcon size={18} color="#92400E" />
                <Text
                  style={{
                    flex: 1,
                    fontSize: 14,
                    fontFamily: "Nunito_700Bold",
                    color: "#92400E",
                  }}
                >
                  {t("native.cardDetail.craft")}
                </Text>
                <View
                  style={{
                    backgroundColor: "#FDE047",
                    borderRadius: 999,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: "Nunito_700Bold",
                      color: "#92400E",
                    }}
                  >
                    −{getDustCraftCost(entry.card.rarity.name)} ✨
                  </Text>
                </View>
              </Pressable>

              {/* Errors */}
              {recycleError || craftError ? (
                <Text
                  style={{
                    color: "#DC2626",
                    fontFamily: "Nunito_400Regular",
                    fontSize: 12,
                    textAlign: "center",
                  }}
                >
                  {recycleError || craftError}
                </Text>
              ) : null}

              {/* Close button */}
              <Pressable
                onPress={() => {
                  if (!isBusy) onClose();
                }}
                style={{
                  width: "100%",
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: "center",
                  backgroundColor: "#fff",
                  shadowColor: "#000",
                  shadowOpacity: 0.08,
                  shadowRadius: 6,
                  marginBottom: 16,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Nunito_600SemiBold",
                    color: "#DB2777",
                    fontSize: 14,
                  }}
                >
                  Close
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      ) : null}
    </Modal>
  );
}
