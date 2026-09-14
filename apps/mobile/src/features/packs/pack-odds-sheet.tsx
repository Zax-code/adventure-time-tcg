import { ModalBottomSheet } from "@swmansion/react-native-bottom-sheet";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CoinIcon } from "../../components/icons";
import { getPackOpeningArtSource } from "../../components/pack-opening-art";
import { RARITY_COLORS } from "../../components/theme";
import { useTranslation } from "../../i18n";
import { localizeRarityName } from "../../lib/combat-i18n";
import { useThemeStore } from "../../stores/theme-store";
import { THEME_COLORS } from "../../theme/themes";
import {
  formatPackAvailabilityDate,
  getPackArtUrl,
  isPackLimited,
  type Pack,
} from "./opening-model";
import { formatBaseRarityPercentage } from "./pack-odds-format";

export function PackOddsSheet({
  pack,
  coins,
  onClose,
}: {
  pack: Pack;
  coins: number;
  onClose: () => void;
}) {
  const { t, locale } = useTranslation();
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(1);
  const odds = pack.odds;
  const guaranteedRarity = odds.guaranteedRarity
    ? localizeRarityName(odds.guaranteedRarity, t)
    : null;
  const currentAvailability = isPackLimited(pack)
    ? pack.availability?.nextAvailableAt
      ? t("packs.weeklyLimitAvailable", {
          date: formatPackAvailabilityDate(pack.availability.nextAvailableAt),
        })
      : t("packs.weeklyLimitReached")
    : coins < pack.cost
      ? t("packs.needMoreCoinsShort", { count: pack.cost - coins })
      : t("packs.readyNow");
  const weeklyLimitDescription = odds.weeklyLimit
    ? pack.availability?.limit
      ? t("packs.odds.weeklyLimitCount", {
          count: pack.availability.limit,
        })
      : t("packs.odds.weeklyLimitBody")
    : t("packs.odds.noWeeklyLimitBody");
  const surface = useMemo(
    () => (
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: tc.bg,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
          },
        ]}
      />
    ),
    [tc.bg],
  );

  return (
    <ModalBottomSheet
      index={index}
      onIndexChange={setIndex}
      onSettle={(nextIndex) => {
        if (nextIndex === 0) onClose();
      }}
      detents={[0, "content"]}
      scrimColor={
        themeName === "nightosphere"
          ? "rgba(6,1,10,0.78)"
          : "rgba(74,34,50,0.4)"
      }
      surface={surface}
    >
      <View
        testID="pack-odds-sheet"
        accessibilityViewIsModal
        className="overflow-hidden rounded-t-[32px] bg-bg"
        style={{
          maxHeight: Math.max(0, height - Math.max(insets.top + 16, 56)),
        }}
      >
        <View className="items-center pb-2 pt-3">
          <View
            className="h-1.5 w-10 rounded-full"
            style={{ backgroundColor: tc.muted }}
          />
        </View>

        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: Math.max(insets.bottom + 28, 52),
            gap: 16,
          }}
        >
          <View className="flex-row items-center gap-4 border-b border-primaryTint pb-4">
            <Image
              source={getPackOpeningArtSource({
                guaranteedRarity: pack.guaranteedRarity,
                name: pack.name,
                packArtAssetId: pack.packArtAssetId,
                packArtUrl: getPackArtUrl(pack),
              })}
              contentFit="contain"
              style={{ width: 82, height: 112 }}
              accessibilityLabel={pack.name}
            />
            <View className="flex-1 gap-2">
              <Text className="font-nunito-extrabold text-2xl leading-7 text-fg">
                {pack.name}
              </Text>
              <Text className="font-nunito-semibold text-sm text-fgMuted">
                {t("packs.odds.title")}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                <View className="flex-row items-center gap-1.5 rounded-full bg-primaryTint px-3 py-1.5">
                  <CoinIcon size={15} />
                  <Text className="font-nunito-extrabold text-sm text-primaryText">
                    {pack.cost}
                  </Text>
                </View>
                <View className="rounded-full bg-secondaryTint px-3 py-1.5">
                  <Text className="font-nunito-extrabold text-sm text-secondaryText">
                    {t("packs.cardsCount", { count: pack.cardCount })}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View className="gap-3">
            <Text className="font-nunito-extrabold text-lg text-fg">
              {t("packs.odds.slotsTitle")}
            </Text>
            <View
              testID="pack-odds-guaranteed-slots"
              className="gap-1 rounded-[20px] border border-secondaryBorder bg-secondaryTint p-4"
            >
              <Text className="font-nunito-extrabold text-sm text-secondaryText">
                {t("packs.odds.guaranteedTitle")}
              </Text>
              <Text className="font-nunito text-[13px] leading-5 text-fgMuted">
                {odds.guaranteedSlotCount > 0 && guaranteedRarity
                  ? t("packs.odds.guaranteedBody", {
                      rarity: guaranteedRarity,
                    })
                  : t("packs.odds.noGuaranteedBody")}
              </Text>
            </View>
            <View
              testID="pack-odds-random-slots"
              className="gap-1 rounded-[20px] border border-primaryBorder bg-primaryTint p-4"
            >
              <Text className="font-nunito-extrabold text-sm text-primaryText">
                {t("packs.odds.randomTitle")}
              </Text>
              <Text className="font-nunito text-[13px] leading-5 text-fgMuted">
                {odds.randomSlotCount > 0
                  ? t("packs.odds.randomBody", {
                      count: odds.randomSlotCount,
                    })
                  : t("packs.odds.noRandomBody")}
              </Text>
            </View>
          </View>

          {odds.randomSlotCount > 0 ? (
            <View
              testID="pack-odds-distribution"
              className="gap-3 rounded-[24px] border border-primaryBorder bg-surface p-4"
            >
              <View className="gap-1">
                <Text className="font-nunito-extrabold text-lg text-fg">
                  {t("packs.odds.distributionTitle")}
                </Text>
                <Text className="font-nunito text-[13px] leading-5 text-fgMuted">
                  {t("packs.odds.distributionSubtitle")}
                </Text>
              </View>

              {odds.baseRarityPercentages ? (
                <View className="gap-3">
                  {odds.baseRarityPercentages.map((row) => {
                    const rarityColors =
                      RARITY_COLORS[row.rarity] ?? RARITY_COLORS.Common;
                    const percentage = formatBaseRarityPercentage(
                      row.percentage,
                      locale,
                    );

                    return (
                      <View
                        key={row.rarity}
                        testID={`pack-odds-row-${row.rarity.toLowerCase()}`}
                        accessibilityLabel={`${localizeRarityName(row.rarity, t)}, ${percentage}`}
                        className="gap-1.5"
                      >
                        <View className="flex-row items-center justify-between gap-3">
                          <Text className="font-nunito-bold text-sm text-fg">
                            {localizeRarityName(row.rarity, t)}
                          </Text>
                          <Text
                            className="font-nunito-extrabold text-sm"
                            style={{ color: rarityColors.to }}
                          >
                            {percentage}
                          </Text>
                        </View>
                        <View className="h-2 overflow-hidden rounded-full bg-surfaceMuted">
                          {row.percentage > 0 ? (
                            <LinearGradient
                              colors={[rarityColors.from, rarityColors.to]}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={{
                                width: `${row.percentage}%`,
                                height: 8,
                                borderRadius: 999,
                              }}
                            />
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                  <Text className="font-nunito text-xs leading-[18px] text-fgMuted">
                    {t("packs.odds.independentDraws")}
                  </Text>
                </View>
              ) : (
                <View
                  testID="pack-odds-unavailable"
                  className="rounded-[18px] bg-infoTint p-3.5"
                >
                  <Text className="font-nunito-bold text-[13px] leading-5 text-infoText">
                    {t("packs.odds.distributionUnavailable")}
                  </Text>
                </View>
              )}
            </View>
          ) : null}

          <View
            testID="pack-odds-availability"
            className="gap-1 rounded-[24px] border border-primaryBorder bg-surface p-4"
          >
            <Text className="font-nunito-extrabold text-lg text-fg">
              {t("packs.odds.availabilityTitle")}
            </Text>
            <Text className="font-nunito-extrabold text-sm text-primaryText">
              {currentAvailability}
            </Text>
            <Text className="font-nunito text-[13px] leading-5 text-fgMuted">
              {weeklyLimitDescription}
            </Text>
            {odds.weeklyLimit && pack.availability?.opensRemaining != null ? (
              <Text className="font-nunito-bold text-[13px] text-fgMuted">
                {t("packs.odds.weeklyRemaining", {
                  count: pack.availability.opensRemaining,
                })}
              </Text>
            ) : null}
          </View>
        </ScrollView>
      </View>
    </ModalBottomSheet>
  );
}
