import { Text, View } from "react-native";

import type { TargetingMode } from "./types";

interface TargetSelectionHintProps {
  targeting: TargetingMode | null;
}

export function TargetSelectionHint({ targeting }: TargetSelectionHintProps) {
  if (!targeting) return null;
  return (
    <View
      style={{
        position: "absolute",
        top: 8,
        alignSelf: "center",
        backgroundColor: "rgba(0,0,0,0.7)",
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        zIndex: 50,
      }}
    >
      <Text
        style={{
          color: "#fff",
          fontSize: 14,
          fontFamily: "Nunito_700Bold",
          textAlign: "center",
        }}
      >
        Select a target
      </Text>
    </View>
  );
}
