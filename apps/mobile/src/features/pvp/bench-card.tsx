import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { SparklesIcon } from "../../components/icons";
import { useTranslation } from "../../i18n";
import { useThemeStore } from "../../stores/theme-store";
import { THEME_COLORS } from "../../theme/themes";
import { resolveBattleImageUrl } from "./image-url";
import type { PvpUnitState } from "./types";

interface BenchCardProps {
  unit: PvpUnitState;
  testID?: string;
  isSelected?: boolean;
  isSwapTarget?: boolean;
  isValidTarget?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}

export function BenchCard({
  unit,
  testID,
  isSelected,
  isSwapTarget,
  isValidTarget,
  onPress,
  onLongPress,
}: BenchCardProps) {
  const { t } = useTranslation();
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const isDead = unit.hp <= 0;
  const hpPct = Math.max(0, unit.hp / Math.max(1, unit.maxHp));
  const borderColor = isSelected
    ? tc.secondaryDark
    : isSwapTarget
      ? tc.successDark
      : isValidTarget
        ? tc.accentDark
        : "transparent";
  const opacity = isDead
    ? 0.4
    : isSelected || isSwapTarget || isValidTarget
      ? 1
      : 0.6;
  const hasPublicPassive = unit.passives.length > 0;

  const imageUrl = resolveBattleImageUrl(unit.imageUrl);

  return (
    <Pressable
      accessibilityRole="button"
      accessible
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      testID={testID}
      style={({ pressed }) => ({
        width: "100%",
        height: "100%",
        opacity: pressed ? opacity * 0.92 : opacity,
        backgroundColor: "transparent",
        borderRadius: 14,
        boxShadow:
          isSelected || isSwapTarget || isValidTarget
            ? "0 4px 8px rgba(99,102,241,0.24)"
            : "0 3px 7px rgba(15,23,42,0.08)",
      })}
    >
      {imageUrl ? (
        <View
          className="overflow-hidden rounded-[14px]"
          style={{
            width: "100%",
            height: 40,
            backgroundColor: isDead ? "rgba(15,23,42,0.68)" : tc.surfaceMuted,
            borderColor,
            borderWidth: isSelected || isSwapTarget || isValidTarget ? 2 : 0,
          }}
        >
          <Image
            source={{ uri: imageUrl }}
            style={{ width: "100%", height: "100%", borderRadius: 14 }}
            contentFit="cover"
          />
        </View>
      ) : (
        <View
          className="items-center justify-center overflow-hidden rounded-[14px] bg-primaryTint"
          style={{
            width: "100%",
            height: 40,
            borderColor,
            borderWidth: isSelected || isSwapTarget || isValidTarget ? 2 : 0,
          }}
        >
          <Text
            className="font-nunito-extrabold text-primaryText"
            style={{ fontSize: 13 }}
          >
            {unit.name.charAt(0)}
          </Text>
        </View>
      )}

      <LinearGradient
        pointerEvents="none"
        colors={["rgba(0,0,0,0.02)", "rgba(0,0,0,0.62)"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          left: 0,
          height: 40,
          borderRadius: 14,
        }}
      />

      {isDead ? (
        <View className="absolute left-0 right-0 top-0 h-10 items-center justify-center rounded-[14px] bg-black/55">
          <Text className="font-nunito-bold text-xs text-white">KO</Text>
        </View>
      ) : null}

      {hasPublicPassive && !isDead ? (
        <View
          accessibilityLabel={t("pvp.publicPassive")}
          className="absolute right-1 top-1 h-[18px] w-[18px] items-center justify-center rounded-full bg-amber-400/90"
        >
          <SparklesIcon size={10} color="#78350F" />
        </View>
      ) : null}

      <View className="mt-1 h-1.5 px-1.5">
        <View className="h-full overflow-hidden rounded-full bg-slate-950/60">
          <View
            style={{
              height: "100%",
              width: `${hpPct * 100}%`,
              backgroundColor:
                hpPct > 0.5 ? "#22C55E" : hpPct > 0.25 ? "#F59E0B" : "#EF4444",
            }}
          />
        </View>
      </View>
    </Pressable>
  );
}
