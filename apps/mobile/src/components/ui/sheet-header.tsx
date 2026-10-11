import type { Ref } from "react";
import { Text, View } from "react-native";

export interface SheetHeaderProps {
  title?: string;
  subtitle?: string;
  // For sheets that move accessibility focus to the title when they open.
  headingRef?: Ref<Text>;
  testID?: string;
}

// Shared by route sheets (ModalSheetRoute) and inline ModalBottomSheets. The
// whole block is the grab area, so keep it free of buttons.
export function SheetHeader({
  title,
  subtitle,
  headingRef,
  testID,
}: SheetHeaderProps) {
  return (
    <View
      testID={testID}
      className="items-center gap-[6px] border-b border-primaryBorder bg-surface px-ds-5 pb-[14px] pt-[10px]"
    >
      <View className="h-ds-1 w-[40px] rounded-ds-pill bg-primaryBorder" />
      {title ? (
        <Text
          ref={headingRef}
          accessibilityRole="header"
          className="text-center font-nunito-extrabold text-ds-h2 text-fg"
          numberOfLines={2}
        >
          {title}
        </Text>
      ) : null}
      {subtitle ? (
        <Text
          className="text-center font-nunito text-ds-sm text-fgMuted"
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
