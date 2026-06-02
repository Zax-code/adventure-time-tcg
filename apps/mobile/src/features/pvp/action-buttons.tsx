import { View } from "react-native";
import { BlurView } from "expo-blur";

import { CheckIcon, SwapIcon, XIcon } from "../../components/icons";
import { ThemedExpoButton } from "../../components/expo-ui/themed-button";

interface ActionButtonsProps {
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
  isSwapMode,
  isTargeting,
  hasBench,
  isMyTurn,
  isActing,
  onSwapToggle,
  onCancel,
  onEndTurn,
}: ActionButtonsProps) {
  const showCancel = isTargeting || isSwapMode;
  const swapDisabled = !hasBench || !isMyTurn;
  const endDisabled = !isMyTurn || isActing;

  return (
    <View className="absolute bottom-1.5 right-1.5 z-50">
      <BlurView
        intensity={40}
        style={{
          borderRadius: 14,
          overflow: "hidden",
          flexDirection: "row",
          gap: 6,
          padding: 6,
          backgroundColor: "rgba(255,255,255,0.55)",
          shadowColor: "rgba(236,72,153,0.18)",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 1,
          shadowRadius: 14,
          elevation: 6,
        }}
      >
        {/* Swap button */}
        <ThemedExpoButton
          onPress={swapDisabled ? undefined : onSwapToggle}
          disabled={swapDisabled}
          testID="pvp-action-swap-button"
          fallbackAppearance={{
            backgroundColor: isSwapMode
              ? "rgba(251,191,36,0.95)"
              : "rgba(255,255,255,0.9)",
            borderColor: isSwapMode ? "rgba(245,158,11,0.7)" : "transparent",
            borderRadius: 8,
            paddingHorizontal: 0,
            paddingVertical: 0,
            minHeight: 36,
            gradientColors: null,
          }}
          style={{
            width: 36,
            height: 36,
            minWidth: 36,
            minHeight: 36,
          }}
          variant="ghost"
        >
          <SwapIcon size={15} color={isSwapMode ? "#854D0E" : "#334155"} />
        </ThemedExpoButton>

        {/* Cancel button */}
        {showCancel && (
          <ThemedExpoButton
            onPress={onCancel}
            testID="pvp-action-cancel-button"
            fallbackAppearance={{
              backgroundColor: "#f43f5e",
              borderColor: "transparent",
              borderRadius: 8,
              paddingHorizontal: 0,
              paddingVertical: 0,
              minHeight: 36,
              gradientColors: null,
            }}
            style={{
              width: 36,
              height: 36,
              minWidth: 36,
              minHeight: 36,
            }}
            variant="danger"
          >
            <XIcon size={15} color="#fff" />
          </ThemedExpoButton>
        )}

        {/* End turn button */}
        <ThemedExpoButton
          onPress={endDisabled ? undefined : onEndTurn}
          disabled={endDisabled}
          testID="pvp-action-end-turn-button"
          fallbackAppearance={{
            backgroundColor: "rgba(255,255,255,0.9)",
            borderColor: "transparent",
            borderRadius: 8,
            paddingHorizontal: 0,
            paddingVertical: 0,
            minHeight: 36,
            gradientColors: null,
          }}
          style={{
            width: 36,
            height: 36,
            minWidth: 36,
            minHeight: 36,
          }}
          variant="ghost"
        >
          <CheckIcon size={15} color="#0f766e" />
        </ThemedExpoButton>
      </BlurView>
    </View>
  );
}
