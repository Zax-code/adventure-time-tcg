import { Text, View } from "react-native";

export function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 items-center gap-1 rounded-2xl bg-surface px-2 py-3">
      <Text className="text-center font-nunito-bold text-[11px] uppercase text-fgMuted">
        {label}
      </Text>
      <Text
        className="text-center font-nunito-extrabold text-lg text-fg"
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {value}
      </Text>
    </View>
  );
}
