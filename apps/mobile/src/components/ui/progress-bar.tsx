import { View } from "react-native";

export interface ProgressBarProps {
  // 0 to 1.
  value: number;
  complete?: boolean;
  accessibilityLabel?: string;
  className?: string;
  testID?: string;
}

export function ProgressBar({
  value,
  complete,
  accessibilityLabel,
  className,
  testID,
}: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const done = complete ?? clamped >= 1;

  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      className={`h-ds-2 overflow-hidden rounded-ds-pill bg-primaryTint ${className ?? ""}`}
    >
      <View
        className={`h-full rounded-ds-pill ${done ? "bg-successDark" : "bg-primary"}`}
        style={{ width: `${clamped * 100}%` }}
      />
    </View>
  );
}
