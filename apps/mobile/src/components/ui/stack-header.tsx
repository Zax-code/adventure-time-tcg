import { Text, View } from "react-native";
import ChevronLeft from "lucide-react-native/icons/chevron-left";

import { IconButton } from "./icon-button";
import type { IconSlot } from "./tokens";

export interface StackHeaderAction {
  icon: IconSlot;
  accessibilityLabel: string;
  onPress: () => void;
  testID?: string;
}

export interface StackHeaderProps {
  title?: string;
  onBack: () => void;
  backLabel: string;
  backTestID?: string;
  trailing?: StackHeaderAction;
  className?: string;
  testID?: string;
}

// Pushed screens: back IconButton, centered 17/800 title, optional trailing
// IconButton, 56 high on a transparent background.
export function StackHeader({
  title,
  onBack,
  backLabel,
  backTestID,
  trailing,
  className,
  testID,
}: StackHeaderProps) {
  return (
    <View
      testID={testID}
      className={`h-header flex-row items-center gap-ds-2 px-ds-4 py-ds-2 ${className ?? ""}`}
    >
      <IconButton
        icon={ChevronLeft}
        accessibilityLabel={backLabel}
        onPress={onBack}
        hitSlop={4}
        testID={backTestID}
      />
      <View className="flex-1 items-center justify-center">
        {title ? (
          <Text
            accessibilityRole="header"
            className="text-center font-nunito-extrabold text-ds-h3 text-fg"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {title}
          </Text>
        ) : null}
      </View>
      {trailing ? (
        <IconButton
          icon={trailing.icon}
          accessibilityLabel={trailing.accessibilityLabel}
          onPress={trailing.onPress}
          testID={trailing.testID}
        />
      ) : (
        <View
          className="h-icon-button w-icon-button"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      )}
    </View>
  );
}
