import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";

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
  const isDead = unit.hp <= 0;
  const hpPct = Math.max(0, unit.hp / Math.max(1, unit.maxHp));
  const borderColor = isSelected ? "#22D3EE" : isSwapTarget ? "#22C55E" : isValidTarget ? "#FBBF24" : "transparent";
  const opacity = isDead ? 0.4 : isSelected || isSwapTarget || isValidTarget ? 1 : 0.6;

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
        height: "100%",
        aspectRatio: 5 / 3,
        overflow: "hidden",
        opacity: pressed ? opacity * 0.92 : opacity,
        backgroundColor: isDead ? "rgba(15,23,42,0.55)" : "rgba(226,232,240,0.55)",
        borderColor,
        borderWidth: 2,
        borderRadius: 10,
      })}
    >
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
      ) : (
        <View className="h-full w-full items-center justify-center bg-slate-700">
          <Text style={{ color: "#cbd5e1", fontSize: 10 }}>{unit.name.charAt(0)}</Text>
        </View>
      )}

      {isDead ? (
        <View className="absolute inset-0 items-center justify-center bg-black/55">
          <Text className="font-nunito-bold text-xs text-white">KO</Text>
        </View>
      ) : null}

      <View className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
        <View
          style={{
            height: "100%",
            width: `${hpPct * 100}%`,
            backgroundColor: hpPct > 0.5 ? "#22C55E" : hpPct > 0.25 ? "#F59E0B" : "#EF4444",
          }}
        />
      </View>
    </Pressable>
  );
}
