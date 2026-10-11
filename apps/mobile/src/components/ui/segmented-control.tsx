import { Pressable, Text, View } from "react-native";

import { ON_PRIMARY } from "@adventure-time/theme";

import {
  type IconSlot,
  SlotIcon,
  type Tone,
  toneTextColor,
  useThemePalette,
} from "./tokens";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  // Rendered inline as "Label · 12", never on a second line.
  count?: number | string;
  // Optional 14px leading status icon. It takes the tone's text color, and
  // onPrimary on the active segment.
  icon?: IconSlot;
  iconTone?: Tone;
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
  const tc = useThemePalette();

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
            className={`flex-1 flex-row items-center justify-center gap-[6px] rounded-ds-pill px-ds-2 ${
              active ? "bg-primary" : ""
            }`}
          >
            <SlotIcon
              icon={option.icon}
              color={
                active ? ON_PRIMARY : toneTextColor(tc, option.iconTone ?? "primary")
              }
              size={14}
            />
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
