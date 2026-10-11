import { useMemo, useState } from "react";
import { ModalBottomSheet } from "@swmansion/react-native-bottom-sheet";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RADIUS } from "@adventure-time/theme";

import { Card } from "../../components/ui/card";
import { Chip } from "../../components/ui/chip";
import { SheetHeader } from "../../components/ui/sheet-header";
import { getBackdropColor, TONE_CLASS } from "../../components/ui/tokens";
import { useTranslation } from "../../i18n";
import { localizeRarityName } from "../../lib/combat-i18n";
import { useThemeStore } from "../../stores/theme-store";
import {
  type DropRateRarity,
  getDropRateShares,
  getRarityIcon,
  getRarityTone,
} from "./opening-model";

export function DropRatesSheet({
  rarities,
  onClose,
}: {
  rarities: readonly DropRateRarity[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const themeName = useThemeStore((state) => state.themeName);
  const [index, setIndex] = useState(1);
  const maxSheetHeight = Math.max(0, height - Math.max(insets.top + 16, 56));
  const bottomContentPadding = Math.max(insets.bottom + 16, 40);
  const shares = useMemo(() => getDropRateShares(rarities), [rarities]);
  const sheetSurface = useMemo(
    () => (
      <View
        className="bg-surface"
        style={[
          StyleSheet.absoluteFill,
          {
            borderTopLeftRadius: RADIUS.xl,
            borderTopRightRadius: RADIUS.xl,
          },
        ]}
      />
    ),
    [],
  );

  return (
    <ModalBottomSheet
      index={index}
      onIndexChange={setIndex}
      onSettle={(nextIndex) => {
        if (nextIndex === 0) {
          onClose();
        }
      }}
      detents={[0, "content"]}
      scrimColor={getBackdropColor(themeName)}
      surface={sheetSurface}
    >
      <View
        className="overflow-hidden rounded-t-ds-xl bg-surface"
        style={{ maxHeight: maxSheetHeight }}
        testID="packs-drop-rates-sheet"
      >
        <SheetHeader
          title={t("packs.dropRates")}
          subtitle={t("packs.dropRatesHint")}
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: bottomContentPadding,
          }}
        >
          <Card className="gap-[14px]">
            {shares.map(({ rarity, share, label }) => {
              const tone = getRarityTone(rarity.name);
              const name = localizeRarityName(rarity.name, t);

              return (
                <View
                  key={rarity.id}
                  className="flex-row items-center gap-[10px]"
                  accessible
                  accessibilityLabel={`${name}, ${label}`}
                >
                  <Chip
                    tone={tone}
                    icon={getRarityIcon(rarity.name)}
                    label={name}
                  />
                  <View className="h-[8px] flex-1 overflow-hidden rounded-ds-pill bg-surfaceMuted">
                    <View
                      className={`h-full rounded-ds-pill ${TONE_CLASS[tone].fill}`}
                      style={{ width: `${share * 100}%` }}
                    />
                  </View>
                  <Text className="w-[44px] text-right font-nunito-extrabold text-ds-body text-fg">
                    {label}
                  </Text>
                </View>
              );
            })}
          </Card>
        </ScrollView>
      </View>
    </ModalBottomSheet>
  );
}
