import { Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import type { CollectionResponse } from "@adventure-time/api-client";

import { useTranslation } from "../../i18n";
import {
  localizeAbilityText,
  localizeStatusName,
  localizeTypeName,
} from "../../lib/combat-i18n";
import { getCardImageCacheKey, getCardImageUrl } from "../../lib/card-images";
import { CARD_TYPE_COLORS } from "../theme";
import { SwordsIcon } from "../icons";

type BuilderCard = CollectionResponse["cards"][number]["card"];

interface PreviewStatus {
  name: string;
  duration: number;
  magnitude?: number | null;
}

interface LoadoutCardDetailsContentProps {
  card: BuilderCard;
  statuses?: PreviewStatus[];
  onClose?: () => void;
}

const abilityCardClasses: Record<"PASSIVE" | "SKILL" | "ULTIMATE", string> = {
  PASSIVE: "border-infoBorder bg-infoTint",
  SKILL: "border-successBorder bg-successTint",
  ULTIMATE: "border-dangerBorder bg-dangerTint",
};

const abilityLabelClasses: Record<"PASSIVE" | "SKILL" | "ULTIMATE", string> = {
  PASSIVE: "bg-infoBorder text-infoDark",
  SKILL: "bg-successBorder text-successDark",
  ULTIMATE: "bg-dangerBorder text-dangerDark",
};

function getRarityTextClass(rarity: string) {
  switch (rarity) {
    case "Uncommon":
      return "text-successDark";
    case "Rare":
      return "text-infoDark";
    case "Epic":
      return "text-accentText";
    case "Legendary":
      return "text-secondaryText";
    default:
      return "text-fgMuted";
  }
}

function getStatusDescription(
  name: string,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const fullKey = `pvp.reference.statusDesc.${name}`;
  const fullValue = t(fullKey);
  if (fullValue !== fullKey) {
    return fullValue;
  }

  const shortKey = `combat.statusDescription.${name}`;
  const shortValue = t(shortKey);
  return shortValue === shortKey ? t("pvp.statusEffect") : shortValue;
}

function isDebuff(name: string) {
  return [
    "Burn",
    "Freeze",
    "Vulnerable",
    "Weakened",
    "Silence",
    "SummoningSickness",
    "Stunned",
    "Poison",
    "Mark",
    "Doom",
  ].includes(name);
}

export function LoadoutCardDetailsContent({
  card,
  statuses = [],
  onClose,
}: LoadoutCardDetailsContentProps) {
  const { t, locale } = useTranslation();
  const typeColor = CARD_TYPE_COLORS[card.type] ?? CARD_TYPE_COLORS.Hero;
  const hpPct = 100;
  const abilities = [
    card.abilities?.passive,
    card.abilities?.skill,
    card.abilities?.ultimate,
  ].filter(Boolean);

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      <View className="relative h-72 overflow-hidden">
        {card.imageAssetId ? (
          <Image
            source={{
              uri: getCardImageUrl(card.imageAssetId),
              cacheKey: getCardImageCacheKey(card.imageAssetId),
            }}
            contentFit="cover"
            cachePolicy="memory-disk"
            style={{ width: "100%", height: "100%" }}
          />
        ) : (
          <View
            className="h-full w-full items-center justify-center"
            style={{ backgroundColor: typeColor.light }}
          >
            <Text
              className="font-nunito-extrabold text-7xl"
              style={{ color: typeColor.dark }}
            >
              {(card.character || card.name || "?").charAt(0)}
            </Text>
          </View>
        )}

        <LinearGradient
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.86)"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
        />

        <View className="absolute left-4 top-4 rounded-xl px-3 py-1.5" style={{ backgroundColor: typeColor.dark }}>
          <Text className="font-nunito-bold text-xs text-white">
            {localizeTypeName(card.type, t)}
          </Text>
        </View>

        <View className="absolute bottom-0 left-0 right-0 gap-1 px-5 py-5">
          <Text className="font-nunito text-base italic text-white/80">{card.name}</Text>
          <Text className="font-nunito-extrabold text-3xl text-white">
            {card.character || t("pvp.unknown")}
          </Text>
          <Text className={`font-nunito-bold text-sm ${getRarityTextClass(card.rarity.name)}`}>
            {card.rarity.name}
          </Text>
        </View>
      </View>

      <View className="gap-4 px-5 pt-5">
        <View className="gap-1">
          <View className="flex-row items-center justify-between">
            <Text className="font-nunito-semibold text-sm text-primaryDark">HP</Text>
            <Text className="font-nunito-bold text-sm text-fg">
              {card.hp} / {card.hp}
            </Text>
          </View>
          <View className="h-3 overflow-hidden rounded-full bg-surfaceMuted">
            <View
              className="h-full rounded-full bg-success"
              style={{ width: `${hpPct}%` }}
            />
          </View>
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1 rounded-2xl bg-dangerTint p-3">
            <SwordsIcon size={18} color="#F43F5E" />
            <Text className="mt-2 font-nunito-extrabold text-lg text-dangerDark">
              {card.attack}
            </Text>
            <Text className="font-nunito text-xs text-dangerDark">{t("pvp.atk")}</Text>
          </View>
          <View className="flex-1 rounded-2xl bg-infoTint p-3">
            <Text className="font-nunito-extrabold text-base text-infoDark">DEF</Text>
            <Text className="mt-2 font-nunito-extrabold text-lg text-infoDark">
              {card.defense}
            </Text>
            <Text className="font-nunito text-xs text-infoDark">{t("pvp.def")}</Text>
          </View>
          <View className="flex-1 rounded-2xl bg-successTint p-3">
            <Text className="font-nunito-extrabold text-base text-successDark">SPD</Text>
            <Text className="mt-2 font-nunito-extrabold text-lg text-successDark">
              {card.speed}
            </Text>
            <Text className="font-nunito text-xs text-successDark">{t("pvp.spd")}</Text>
          </View>
        </View>

        {statuses.length > 0 ? (
          <View className="gap-2">
            <Text className="font-nunito-bold text-sm text-primaryDark">
              {t("pvp.activeEffects")}
            </Text>
            {statuses.map((status, index) => {
              const debuff = isDebuff(status.name);
              return (
                <View
                  key={`${status.name}-${index}`}
                  className={`rounded-2xl border p-3 ${debuff ? "border-dangerBorder bg-dangerTint" : "border-infoBorder bg-infoTint"}`}
                >
                  <View className="flex-row items-center gap-2">
                    <View className={`rounded-full px-2 py-1 ${debuff ? "bg-dangerBorder" : "bg-infoBorder"}`}>
                      <Text className={`font-nunito-bold text-[10px] ${debuff ? "text-dangerDark" : "text-infoDark"}`}>
                        {status.duration === -1 ? t("pvp.untilUsed") : `${status.duration}T`}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className={`font-nunito-bold text-sm ${debuff ? "text-dangerDark" : "text-infoDark"}`}>
                        {localizeStatusName(status.name, t)}
                        {status.magnitude ? ` (${status.magnitude})` : ""}
                      </Text>
                      <Text className="mt-1 font-nunito text-xs leading-4 text-fgMuted">
                        {getStatusDescription(status.name, t)}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        <View className="gap-2">
          {abilities.map((ability) => {
            const value = localizeAbilityText(ability!, locale);
            return (
              <View
                key={ability!.key}
                className={`rounded-2xl border p-3 ${abilityCardClasses[ability!.type]}`}
              >
                <View className="mb-2 flex-row items-center gap-2">
                  <View className={`rounded-full px-2 py-1 ${abilityLabelClasses[ability!.type]}`}>
                    <Text className="font-nunito-bold text-[10px] uppercase">
                      {ability!.type}
                    </Text>
                  </View>
                  <Text className="flex-1 font-nunito-bold text-sm text-fg">
                    {value.name}
                  </Text>
                  {ability!.type !== "PASSIVE" ? (
                    <Text className="font-nunito-semibold text-xs text-fgMuted">
                      {ability!.cost} EN
                      {ability!.cooldown ? ` · CD ${ability!.cooldown}` : ""}
                    </Text>
                  ) : null}
                </View>
                <Text className="font-nunito text-sm leading-5 text-fgMuted">
                  {value.description}
                </Text>
                {ability!.oncePerMatch ? (
                  <Text className="mt-2 font-nunito-semibold text-xs text-primaryDark">
                    {t("pvp.oncePerMatch")}
                  </Text>
                ) : null}
              </View>
            );
          })}

          {abilities.length === 0 ? (
            <View className="rounded-2xl border border-primaryTint bg-primaryBg p-3">
              <Text className="font-nunito text-sm text-fgMuted">{card.description}</Text>
            </View>
          ) : null}
        </View>

        {onClose ? (
          <Pressable
            onPress={onClose}
            className="mt-2 items-center justify-center rounded-2xl bg-primaryDark px-4 py-3"
          >
            <Text className="font-nunito-bold text-white">{t("common.close")}</Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}
