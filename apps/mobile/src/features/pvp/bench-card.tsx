import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";

import { API_BASE_URL } from "../../lib/api";
import type { PvpUnitState } from "./types";

interface BenchCardProps {
  unit: PvpUnitState;
  isSelected?: boolean;
  isSwapTarget?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}

export function BenchCard({ unit, isSelected, isSwapTarget, onPress, onLongPress }: BenchCardProps) {
  const isDead = unit.hp <= 0;
  const hpPct = Math.max(0, unit.hp / unit.maxHp);
  const hpColor = hpPct > 0.5 ? "#10B981" : hpPct > 0.25 ? "#FACC15" : "#EF4444";

  const borderColor = isSelected
    ? "#2DD4BF"
    : isSwapTarget
    ? "#14B8A6"
    : "transparent";

  const opacity = isDead ? 0.4 : isSwapTarget || isSelected ? 1 : 0.6;

  const imageUrl = unit.imageUrl
    ? unit.imageUrl.startsWith("http")
      ? unit.imageUrl
      : `${API_BASE_URL}${unit.imageUrl}`
    : null;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={{
        height: "100%",
        aspectRatio: 5 / 3,
        borderRadius: 10,
        overflow: "hidden",
        borderWidth: 2,
        borderColor,
        opacity,
      }}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
        />
      ) : (
        <View
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "#374151",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#9CA3AF", fontSize: 10 }}>{unit.name.charAt(0)}</Text>
        </View>
      )}

      {isDead && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#EF4444", fontSize: 12 }}>☠</Text>
        </View>
      )}

      {/* HP bar */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          backgroundColor: "rgba(0,0,0,0.4)",
        }}
      >
        <View
          style={{
            height: "100%",
            width: `${hpPct * 100}%`,
            backgroundColor: hpColor,
          }}
        />
      </View>
    </Pressable>
  );
}
