import { Text, View } from "react-native";

import { Button } from "./button";

export interface PageTitleProps {
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void; testID?: string };
  className?: string;
  testID?: string;
}

// Sits under the AppHeader on every tab screen: left-aligned h1 in fg.
export function PageTitle({
  title,
  subtitle,
  action,
  className,
  testID,
}: PageTitleProps) {
  return (
    <View
      testID={testID}
      className={`flex-row items-end gap-ds-3 pt-ds-2 ${className ?? ""}`}
    >
      <View className="flex-1 gap-ds-1">
        <Text
          accessibilityRole="header"
          className="font-nunito-extrabold text-ds-h1 text-fg"
        >
          {title}
        </Text>
        {subtitle ? (
          <Text className="font-nunito text-ds-body text-fgMuted">{subtitle}</Text>
        ) : null}
      </View>
      {action ? (
        <Button tone="ghost" size="sm" onPress={action.onPress} testID={action.testID}>
          {action.label}
        </Button>
      ) : null}
    </View>
  );
}
