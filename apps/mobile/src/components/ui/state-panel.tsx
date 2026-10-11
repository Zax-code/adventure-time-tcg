import { ActivityIndicator, Text, View } from "react-native";

import CircleAlert from "lucide-react-native/icons/circle-alert";
import Hourglass from "lucide-react-native/icons/hourglass";
import Inbox from "lucide-react-native/icons/inbox";

import { Button } from "./button";
import { IconTile } from "./icon-tile";
import {
  type IconSlot,
  type Tone,
  toneTextColor,
  useThemePalette,
} from "./tokens";

export type StatePanelVariant = "empty" | "error" | "loading";

const DEFAULT_TONE: Record<StatePanelVariant, Tone> = {
  empty: "primary",
  error: "danger",
  loading: "primary",
};

const DEFAULT_ICON: Record<StatePanelVariant, IconSlot> = {
  empty: Inbox,
  error: CircleAlert,
  loading: Hourglass,
};

export interface StatePanelProps {
  title: string;
  body?: string;
  variant?: StatePanelVariant;
  icon?: IconSlot;
  tone?: Tone;
  action?: { label: string; onPress: () => void; testID?: string };
  className?: string;
  testID?: string;
}

export function StatePanel({
  title,
  body,
  variant = "empty",
  icon,
  tone,
  action,
  className,
  testID,
}: StatePanelProps) {
  const tc = useThemePalette();
  const resolvedTone = tone ?? DEFAULT_TONE[variant];

  return (
    <View
      testID={testID}
      accessibilityRole={variant === "error" ? "alert" : undefined}
      className={`items-center gap-ds-3 rounded-ds-lg border border-primaryBorder bg-surface p-ds-6 ${
        className ?? ""
      }`}
    >
      <IconTile
        size={48}
        tone={resolvedTone}
        icon={
          variant === "loading"
            ? () => <ActivityIndicator color={toneTextColor(tc, resolvedTone)} />
            : (icon ?? DEFAULT_ICON[variant])
        }
      />
      <Text className="text-center font-nunito-extrabold text-ds-h3 text-fg">
        {title}
      </Text>
      {body ? (
        <Text className="text-center font-nunito text-ds-body text-fgMuted">
          {body}
        </Text>
      ) : null}
      {action ? (
        <Button size="sm" onPress={action.onPress} testID={action.testID}>
          {action.label}
        </Button>
      ) : null}
    </View>
  );
}
