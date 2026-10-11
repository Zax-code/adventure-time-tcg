import { Pressable, Text, View } from "react-native";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  // Rendered inline as "Label · 12", never on a second line.
  count?: number | string;
  accessibilityLabel?: string;
  testID?: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  testID?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  testID,
}: SegmentedControlProps<T>) {
  return (
    <View
      accessibilityRole="tablist"
      testID={testID}
      className={`h-control-md flex-row gap-ds-1 rounded-ds-pill border border-primaryBorder bg-surface p-ds-1 ${
        className ?? ""
      }`}
    >
      {options.map((option) => {
        const active = option.value === value;
        const label =
          option.count == null ? option.label : `${option.label} · ${option.count}`;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityLabel={option.accessibilityLabel ?? label}
            accessibilityState={{ selected: active }}
            testID={option.testID}
            className={`flex-1 items-center justify-center rounded-ds-pill px-ds-2 ${
              active ? "bg-primary" : ""
            }`}
          >
            <Text
              className={`font-nunito-bold text-ds-sm ${
                active ? "text-white" : "text-primaryText"
              }`}
              numberOfLines={1}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
