import type { ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import Search from "lucide-react-native/icons/search";
import X from "lucide-react-native/icons/x";

import { LoadingPanel } from "../loading-state";
import { KEYBOARD_AWARE_SCROLL_PROPS } from "../keyboard-aware-scroll-props";
import { KeyboardScreenView } from "../keyboard-screen-view";
import { Button, type ButtonTone } from "../ui/button";
import { Chip, type ChipTone } from "../ui/chip";
import { IconButton } from "../ui/icon-button";
import { Input } from "../ui/input";
import { Notice } from "../ui/notice";
import { SegmentedControl } from "../ui/segmented-control";
import { StatePanel } from "../ui/state-panel";
import { StatTile } from "../ui/stat-tile";
import {
  getBackdropColor,
  getElevation,
  ICON_STROKE_WIDTH,
  type IconRender,
  type Tone,
  TONE_CLASS,
  useThemeName,
  useThemePalette,
} from "../ui/tokens";
import { useTranslation } from "../../i18n";
import type { IoniconName } from "../../lib/ionicons";
import { THEME_VARS } from "../../theme/themes";

// Admin screens keep these names, but every component is a thin wrapper over
// the shared design system primitives in components/ui.

function ioniconSlot(name: IoniconName): IconRender {
  return ({ color, size }) => <Ionicons name={name} size={size} color={color} />;
}

export function AdminBackground({ children }: { children: ReactNode }) {
  const themeName = useThemeName();

  return (
    <View style={[{ flex: 1 }, THEME_VARS[themeName] as never]}>
      <View className="flex-1 bg-bg">{children}</View>
    </View>
  );
}

const PANEL_TINT: Record<"primary" | "secondary" | "accent" | "info", Tone> = {
  primary: "primary",
  secondary: "secondary",
  accent: "accent",
  info: "info",
};

// Card: radius 24, padding 16, hairline border; tinted panels use the tone
// tint and border. `chrome` is kept for callers and no longer changes the look.
export function AdminPanel({
  children,
  style,
  tint = "default",
}: {
  children: ReactNode;
  style?: ViewStyle;
  tint?: "default" | "primary" | "secondary" | "accent" | "info";
  chrome?: "default" | "soft";
}) {
  const colors =
    tint === "default"
      ? "bg-surface border-primaryBorder"
      : `${TONE_CLASS[PANEL_TINT[tint]].tint} ${TONE_CLASS[PANEL_TINT[tint]].border}`;

  return (
    <View
      className={`overflow-hidden rounded-ds-lg border p-ds-4 ${colors}`}
      style={style}
    >
      {children}
    </View>
  );
}

// The section card under the "Operations console" PageTitle: 22/800 title,
// optional actions, subtitle and summary content (stats, search) below.
export function AdminHero({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children?: ReactNode;
  chrome?: "default" | "soft";
}) {
  return (
    <AdminPanel>
      <View className="gap-ds-3">
        <View className="flex-row items-start gap-ds-3">
          <Text
            accessibilityRole="header"
            className="flex-1 font-nunito-extrabold text-ds-h2 text-fg"
          >
            {title}
          </Text>
          {actions ? <View className="max-w-[160px]">{actions}</View> : null}
        </View>
        <Text className="font-nunito text-ds-sm text-fgMuted">{subtitle}</Text>
        {children ? <View className="gap-ds-3">{children}</View> : null}
      </View>
    </AdminPanel>
  );
}

const STAT_TONE: Record<
  "default" | "info" | "success" | "warning" | "accent",
  Tone | "neutral"
> = {
  default: "neutral",
  info: "info",
  success: "success",
  warning: "secondary",
  accent: "accent",
};

export function AdminStat({
  label,
  value,
  helper,
  tone = "default",
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: "default" | "info" | "success" | "warning" | "accent";
}) {
  return (
    <StatTile
      className="flex-1"
      tone={STAT_TONE[tone]}
      label={label}
      value={value}
      caption={helper}
    />
  );
}

export function AdminNotice({
  title,
  body,
  tone = "info",
  icon = "sparkles",
}: {
  title: string;
  body: string;
  tone?: "info" | "warning" | "danger" | "success";
  icon?: IoniconName;
}) {
  return <Notice tone={tone} title={title} body={body} icon={ioniconSlot(icon)} />;
}

export function AdminSectionTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View className="flex-row items-center gap-ds-3">
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
      {right}
    </View>
  );
}

export function AdminPageScroll({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      {...KEYBOARD_AWARE_SCROLL_PROPS}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 132,
        gap: 16,
      }}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function AdminSegmentedControl<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: { label: string; value: T }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <View
      pointerEvents={disabled ? "none" : "auto"}
      className={disabled ? "opacity-60" : undefined}
    >
      <SegmentedControl<T>
        options={options.map((option) => ({
          value: option.value,
          label: option.label,
          testID: `admin-segment-${option.value}`,
        }))}
        value={value}
        onChange={onChange}
      />
    </View>
  );
}

export function AdminFilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Chip
      tone={selected ? "selected" : "neutral"}
      label={label}
      onPress={onPress}
      accessibilityState={{ selected }}
    />
  );
}

export function AdminSearchInput({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  const tc = useThemePalette();
  const { t } = useTranslation();

  return (
    <Input
      icon={Search}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      trailing={
        value ? (
          <Pressable
            onPress={() => onChangeText("")}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("common.cancel")}
          >
            <X size={18} color={tc.muted} strokeWidth={ICON_STROKE_WIDTH} />
          </Pressable>
        ) : null
      }
    />
  );
}

type AdminButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "warning";

// Admin "warning" buttons were accent-tinted secondary actions; the shared
// Button has no accent tone, so they render as ghost buttons.
const BUTTON_TONE: Record<AdminButtonVariant, ButtonTone> = {
  primary: "primary",
  secondary: "secondary",
  danger: "danger",
  ghost: "ghost",
  warning: "ghost",
};

export function AdminButton({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: AdminButtonVariant;
  icon?: IoniconName;
  disabled?: boolean;
  borderRadius?: number;
  style?: ViewStyle;
}) {
  return (
    <Button
      tone={BUTTON_TONE[variant]}
      icon={icon ? ioniconSlot(icon) : undefined}
      onPress={onPress}
      disabled={disabled}
      style={style}
    >
      {label}
    </Button>
  );
}

const CHIP_TONE: Record<
  "default" | "success" | "info" | "accent" | "danger" | "warning",
  ChipTone
> = {
  default: "neutral",
  success: "success",
  info: "info",
  accent: "accent",
  danger: "danger",
  warning: "secondary",
};

export function AdminChip({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "success" | "info" | "accent" | "danger" | "warning";
}) {
  return <Chip tone={CHIP_TONE[tone]} label={label} />;
}

const ABILITY_TYPE_TONE: Record<"PASSIVE" | "SKILL" | "ULTIMATE", ChipTone> = {
  PASSIVE: "success",
  SKILL: "info",
  ULTIMATE: "secondary",
};

export function AbilityTypeChip({
  type,
}: {
  type: "PASSIVE" | "SKILL" | "ULTIMATE";
}) {
  const { t } = useTranslation();

  return (
    <Chip tone={ABILITY_TYPE_TONE[type]} label={t(`admin.abilities.type.${type}`)} />
  );
}

export function AdminField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "numeric" | "email-address";
}) {
  return (
    <View className="gap-[6px]">
      <Text className="font-nunito-bold text-ds-caption text-fgMuted">{label}</Text>
      <Input
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 4 : undefined}
        className={multiline ? "min-h-[100px] items-start" : undefined}
      />
    </View>
  );
}

// Dialog anatomy with a close IconButton and a scrollable body, for admin
// forms that do not fit the fixed Dialog actions row.
export function AdminModal({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const themeName = useThemeName();
  const { t } = useTranslation();

  if (!visible) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardScreenView>
        <View
          className="flex-1 justify-center p-ds-4"
          style={[{ backgroundColor: getBackdropColor(themeName) }, THEME_VARS[themeName] as never]}
        >
          <Pressable
            accessible={false}
            className="absolute inset-0"
            onPress={onClose}
          />
          <View
            accessibilityViewIsModal
            className="max-h-[90%] overflow-hidden rounded-ds-xl bg-surface"
            style={{ boxShadow: getElevation(themeName, "overlay") }}
          >
            <View className="flex-row items-center gap-ds-3 border-b border-primaryBorder px-ds-5 py-ds-4">
              <Text
                accessibilityRole="header"
                className="flex-1 font-nunito-extrabold text-[20px] leading-[24px] text-fg"
              >
                {title}
              </Text>
              <IconButton icon={X} accessibilityLabel={t("common.close")} onPress={onClose} />
            </View>
            <ScrollView
              {...KEYBOARD_AWARE_SCROLL_PROPS}
              contentContainerStyle={{ padding: 20, gap: 16 }}
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          </View>
        </View>
      </KeyboardScreenView>
    </Modal>
  );
}

export function AdminEmptyState({
  icon,
  title,
  body,
}: {
  icon: IoniconName;
  title: string;
  body: string;
}) {
  return <StatePanel icon={ioniconSlot(icon)} title={title} body={body} />;
}

export function AdminLoadingState({
  title,
  body,
  icon = "sparkles",
}: {
  title: string;
  body: string;
  icon?: IoniconName;
}) {
  return <LoadingPanel title={title} message={body} icon={icon} />;
}
