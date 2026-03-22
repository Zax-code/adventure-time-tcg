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
    <View className="absolute bottom-4 right-4 z-50">
      <BlurView
        intensity={40}
        style={{
          borderRadius: 12,
          overflow: "hidden",
          flexDirection: "row",
          gap: 6,
          padding: 6,
          backgroundColor: "rgba(255,255,255,0.55)",
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
            backgroundColor: isSwapMode ? "#FDE047" : "rgba(255,255,255,0.9)",
            opacity: swapDisabled ? 0.45 : 1,
          }}
          onPress={swapDisabled ? undefined : onSwapToggle}
        >
          <SwapIcon size={18} color={isSwapMode ? "#854D0E" : "#374151"} />
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
              backgroundColor: "#FB7185",
            }}
            onPress={onCancel}
          >
            <XIcon size={18} color="#fff" />
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
            backgroundColor: "#2DD4BF",
            opacity: endDisabled ? 0.45 : 1,
          }}
          onPress={endDisabled ? undefined : onEndTurn}
        >
          <CheckIcon size={18} color="#fff" />
        </Pressable>
      </BlurView>
    </View>
  );
}
