import { Text, View } from "react-native";

import { CheckIcon, SwapIcon, XIcon, ZapIcon } from "../../components/icons";
import { ThemedExpoButton } from "../../components/expo-ui/themed-button";
import { useThemeStore } from "../../stores/theme-store";
import { THEME_COLORS } from "../../theme/themes";

interface ActionButtonsProps {
  energy: number;
  maxEnergy: number;
  isSwapMode: boolean;
  isTargeting: boolean;
  hasBench: boolean;
  isMyTurn: boolean;
  isActing: boolean;
  onSwapToggle: () => void;
  onCancel: () => void;
  onEndTurn: () => void;
}

export function ActionButtons({
  energy,
  maxEnergy,
  isSwapMode,
  isTargeting,
  hasBench,
  isMyTurn,
  isActing,
  onSwapToggle,
  onCancel,
  onEndTurn,
}: ActionButtonsProps) {
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const showCancel = isTargeting || isSwapMode;
  const swapDisabled = !hasBench || !isMyTurn;
  const endDisabled = !isMyTurn || isActing;

  return (
    <View className="absolute bottom-2 right-0 z-50 items-end gap-2">
      <ActionEnergyPill energy={energy} maxEnergy={maxEnergy} />
      <View
        className="flex-row gap-2"
        style={{ transform: [{ translateX: 13 }] }}
      >
        <ThemedExpoButton
          onPress={swapDisabled ? undefined : onSwapToggle}
          disabled={swapDisabled}
          testID="pvp-action-swap-button"
          fallbackAppearance={{
            backgroundColor: isSwapMode
              ? tc.secondary
              : themeName === "nightosphere"
                ? "rgba(255,255,255,0.18)"
                : "rgba(255,255,255,0.76)",
            borderColor: "transparent",
            borderRadius: 999,
            paddingHorizontal: 0,
            paddingVertical: 0,
            minHeight: 48,
            gradientColors: null,
          }}
          style={{
            width: 48,
            height: 48,
            minWidth: 48,
            minHeight: 48,
            boxShadow: "0 8px 14px rgba(15,23,42,0.14)",
          }}
          variant="ghost"
        >
          <SwapIcon
            size={20}
            color={isSwapMode ? tc.secondaryText : tc.primaryText}
          />
        </ThemedExpoButton>

        {showCancel && (
          <ThemedExpoButton
            onPress={onCancel}
            testID="pvp-action-cancel-button"
            fallbackAppearance={{
              backgroundColor: "#f43f5e",
              borderColor: "transparent",
              borderRadius: 999,
              paddingHorizontal: 0,
              paddingVertical: 0,
              minHeight: 48,
              gradientColors: null,
            }}
            style={{
              width: 48,
              height: 48,
              minWidth: 48,
              minHeight: 48,
              boxShadow: "0 8px 14px rgba(244,63,94,0.2)",
            }}
            variant="danger"
          >
            <XIcon size={20} color="#fff" />
          </ThemedExpoButton>
        )}

        <ThemedExpoButton
          onPress={endDisabled ? undefined : onEndTurn}
          disabled={endDisabled}
          testID="pvp-action-end-turn-button"
          fallbackAppearance={{
            backgroundColor: endDisabled
              ? "rgba(148,163,184,0.32)"
              : tc.successTint,
            borderColor: "transparent",
            borderRadius: 999,
            paddingHorizontal: 0,
            paddingVertical: 0,
            minHeight: 48,
            gradientColors: null,
          }}
          style={{
            width: 48,
            height: 48,
            minWidth: 48,
            minHeight: 48,
            boxShadow: "0 8px 14px rgba(20,184,166,0.18)",
          }}
          variant="ghost"
        >
          <CheckIcon
            size={21}
            color={endDisabled ? tc.muted : tc.successText}
          />
        </ThemedExpoButton>
      </View>
    </View>
  );
}

export function ActionEnergyPill({
  energy,
  maxEnergy,
}: {
  energy: number;
  maxEnergy: number;
}) {
  return (
    <View className="h-9 min-w-[78px] flex-row items-center justify-center gap-1.5 rounded-full bg-secondaryTint px-3">
      <ZapIcon size={16} color="#B45309" />
      <Text className="font-nunito-extrabold text-[16px] text-secondaryText">
        {energy}/{maxEnergy}
      </Text>
    </View>
  );
}
