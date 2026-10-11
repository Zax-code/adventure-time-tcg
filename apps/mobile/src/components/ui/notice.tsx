import type { ReactNode } from "react";
import { Text, View } from "react-native";

import CircleAlert from "lucide-react-native/icons/circle-alert";
import CircleCheck from "lucide-react-native/icons/circle-check";
import Info from "lucide-react-native/icons/info";
import TriangleAlert from "lucide-react-native/icons/triangle-alert";

import { IconTile } from "./icon-tile";
import { type IconSlot, type Tone, TONE_CLASS } from "./tokens";

export type NoticeTone = "info" | "warning" | "success" | "danger";

const NOTICE_TONE: Record<NoticeTone, Tone> = {
  info: "info",
  warning: "secondary",
  success: "success",
  danger: "danger",
};

const DEFAULT_ICON: Record<NoticeTone, IconSlot> = {
  info: Info,
  warning: CircleAlert,
  success: CircleCheck,
  danger: TriangleAlert,
};

export interface NoticeProps {
  title: string;
  body?: string;
  tone?: NoticeTone;
  icon?: IconSlot;
  // Inline actions below the body.
  children?: ReactNode;
  className?: string;
  testID?: string;
}

export function Notice({
  title,
  body,
  tone = "info",
  icon,
  children,
  className,
  testID,
}: NoticeProps) {
  const toneKey = NOTICE_TONE[tone];
  const classes = TONE_CLASS[toneKey];

  return (
    <View
      testID={testID}
      accessibilityRole={tone === "danger" ? "alert" : undefined}
      className={`flex-row gap-ds-3 rounded-ds-md border p-[14px] ${classes.tint} ${
        classes.border
      } ${className ?? ""}`}
    >
      <IconTile icon={icon ?? DEFAULT_ICON[tone]} tone={toneKey} size={32} onTint />
      <View className="flex-1 gap-[2px]">
        <Text className={`font-nunito-extrabold text-ds-body ${classes.text}`}>
          {title}
        </Text>
        {body ? (
          <Text className="font-nunito text-ds-sm text-fg">{body}</Text>
        ) : null}
        {children ? <View className="mt-ds-2 flex-row flex-wrap gap-ds-2">{children}</View> : null}
      </View>
    </View>
  );
}
