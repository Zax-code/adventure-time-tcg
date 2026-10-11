import { Text, View } from "react-native";

import { Button } from "./button";
import type { IconSlot } from "./tokens";

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    onPress: () => void;
    icon?: IconSlot;
    testID?: string;
  };
  className?: string;
  testID?: string;
}

// Sits in the page, never inside a Card.
export function SectionHeader({
  title,
  subtitle,
  action,
  className,
  testID,
}: SectionHeaderProps) {
  return (
    <View
      testID={testID}
      className={`flex-row items-center justify-between gap-ds-3 ${className ?? ""}`}
    >
      <View className="flex-1 gap-[2px]">
        <Text
          accessibilityRole="header"
          className="font-nunito-extrabold text-ds-h2 text-fg"
        >
          {title}
        </Text>
        {subtitle ? (
          <Text className="font-nunito text-ds-sm text-fgMuted">{subtitle}</Text>
        ) : null}
      </View>
      {action ? (
        <Button
          tone="ghost"
          size="sm"
          icon={action.icon}
          onPress={action.onPress}
          testID={action.testID}
        >
          {action.label}
        </Button>
      ) : null}
    </View>
  );
}
