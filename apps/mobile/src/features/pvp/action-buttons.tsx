import { Pressable, View } from "react-native";
import { BlurView } from "expo-blur";

import { CheckIcon, SwapIcon, XIcon } from "../../components/icons";

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
        <Pressable
          style={{
            width: 36,
            height: 36,
            minWidth: 36,
            minHeight: 36,
            borderRadius: 8,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: isSwapMode ? "rgba(251,191,36,0.95)" : "rgba(255,255,255,0.9)",
            opacity: swapDisabled ? 0.45 : 1,
            borderWidth: isSwapMode ? 1 : 0,
            borderColor: "rgba(245,158,11,0.7)",
          }}
          onPress={swapDisabled ? undefined : onSwapToggle}
        >
          <SwapIcon size={15} color={isSwapMode ? "#854D0E" : "#334155"} />
        </Pressable>

        {/* Cancel button */}
        {showCancel && (
          <Pressable
            style={{
              width: 36,
              height: 36,
              minWidth: 36,
              minHeight: 36,
              borderRadius: 8,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#f43f5e",
            }}
            onPress={onCancel}
          >
            <XIcon size={15} color="#fff" />
          </Pressable>
        )}

        {/* End turn button */}
        <Pressable
          style={{
            width: 36,
            height: 36,
            minWidth: 36,
            minHeight: 36,
            borderRadius: 8,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.9)",
            opacity: endDisabled ? 0.45 : 1,
          }}
          onPress={endDisabled ? undefined : onEndTurn}
        >
          <CheckIcon size={15} color="#0f766e" />
        </Pressable>
      </BlurView>
    </View>
  );
}
