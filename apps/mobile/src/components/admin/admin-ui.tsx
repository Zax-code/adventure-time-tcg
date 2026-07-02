import { ReactNode, useEffect, useMemo, useState } from "react";
import { ModalBottomSheet } from "@swmansion/react-native-bottom-sheet";
import Animated, {
  Easing,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LoadingPanel } from "../loading-state";
import { KEYBOARD_AWARE_SCROLL_PROPS } from "../keyboard-aware-scroll-props";
import { KeyboardScreenView } from "../keyboard-screen-view";
import { asStyle } from "../../lib/style-object";
import {
  getAbilityTypePalette,
  pickReadableTextColor,
  type ThemeColors,
  withAlpha,
} from "./admin-palette";
import { ThemedExpoButton } from "../expo-ui/themed-button";
import { ThemedExpoTextInput } from "../expo-ui/themed-text-input";
import { useTranslation } from "../../i18n";
import type { IoniconName } from "../../lib/ionicons";
import { useThemeStore } from "../../stores/theme-store";
import { THEME_COLORS, THEME_VARS } from "../../theme/themes";

const absoluteFill = {
  position: "absolute" as const,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};
const SEGMENTED_CONTROL_PADDING = 8;
const SEGMENTED_CONTROL_GAP = 8;

export function AdminBackground({ children }: { children: ReactNode }) {
  const { themeName } = useThemeStore();

  return (
    <View style={[{ flex: 1 }, THEME_VARS[themeName] as never]}>
      <View className="flex-1 bg-bg">{children}</View>
    </View>
  );
}

export function AdminPanel({
  children,
  style,
  tint = "default",
  chrome = "default",
}: {
  children: ReactNode;
  style?: ViewStyle;
  tint?: "default" | "primary" | "secondary" | "accent" | "info";
  chrome?: "default" | "soft";
}) {
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];
  const backgrounds: Record<typeof tint, string> = {
    default: tc.surface,
    primary: withAlpha(tc.primaryTint, "D9"),
    secondary: withAlpha(tc.secondaryTint, "D9"),
    accent: withAlpha(tc.accentTint, "D9"),
    info: withAlpha(tc.infoTint, "D9"),
  };

  return (
    <View
      className={
        chrome === "soft"
          ? "overflow-hidden rounded-[28] px-4 py-4"
          : "overflow-hidden rounded-[28] border px-4 py-4"
      }
      style={[
        {
          backgroundColor: backgrounds[tint],
          borderColor:
            chrome === "soft"
              ? withAlpha(
                  tc.primaryBorder,
                  themeName === "nightosphere" ? "24" : "1F",
                )
              : withAlpha(tc.primaryBorder, "6B"),
          borderWidth: chrome === "soft" ? StyleSheet.hairlineWidth : undefined,
          boxShadow:
            chrome === "soft"
              ? `0px 10px 24px ${withAlpha(
                  tc.primaryStrong,
                  themeName === "nightosphere" ? "24" : "14",
                )}`
              : `0px 8px 20px ${withAlpha(
                  tc.primaryStrong,
                  themeName === "nightosphere" ? "38" : "1F",
                )}`,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function AdminHero({
  title,
  subtitle,
  actions,
  children,
  chrome = "default",
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children?: ReactNode;
  chrome?: "default" | "soft";
}) {
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];

  return (
    <AdminPanel
      chrome={chrome}
      style={{ paddingHorizontal: 20, paddingVertical: 20 }}
    >
      <LinearGradient
        colors={[withAlpha(tc.primaryTint, "CC"), withAlpha(tc.surface, "00")]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={absoluteFill}
      />
      <View className="gap-4">
        <View className="flex-row items-start gap-4">
          <View className="flex-1 gap-2">
            <Text className="font-nunito-extrabold text-[30px] leading-[34px] text-fg">
              {title}
            </Text>
          </View>
          {actions ? (
            <View className="min-h-[44] min-w-[116] max-w-[148] items-stretch justify-start">
              {actions}
            </View>
          ) : null}
        </View>
        <Text className="font-nunito-semibold text-[14px] leading-[21px] text-fgMuted">
          {subtitle}
        </Text>
        {children ? <View className="gap-3">{children}</View> : null}
      </View>
    </AdminPanel>
  );
}

function getStatPalette(
  tc: ThemeColors,
  tone: "default" | "info" | "success" | "warning" | "accent",
) {
  return {
    default: {
      bg: withAlpha(tc.surfaceMuted, "F0"),
      border: withAlpha(tc.primaryBorder, "66"),
      value: tc.primaryStrong,
      label: tc.fgMuted,
    },
    info: {
      bg: withAlpha(tc.infoTint, "EB"),
      border: withAlpha(tc.infoBorder, "99"),
      value: tc.infoText,
      label: tc.infoText,
    },
    success: {
      bg: withAlpha(tc.successTint, "EB"),
      border: withAlpha(tc.successBorder, "99"),
      value: tc.successText,
      label: tc.successText,
    },
    warning: {
      bg: withAlpha(tc.secondaryTint, "EB"),
      border: withAlpha(tc.secondaryBorder, "99"),
      value: tc.secondaryText,
      label: tc.secondaryText,
    },
    accent: {
      bg: withAlpha(tc.accentTint, "EB"),
      border: withAlpha(tc.accentBorder, "99"),
      value: tc.accentText,
      label: tc.accentText,
    },
  }[tone];
}

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
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];
  const palette = getStatPalette(tc, tone);

  return (
    <View
      className="min-h-[92] flex-1 rounded-[22] border px-4 py-3"
      style={{ backgroundColor: palette.bg, borderColor: palette.border }}
    >
      <Text
        className="font-nunito-extrabold text-[24px]"
        style={{ color: palette.value }}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text
        className="mt-1 font-nunito-bold text-[12px] uppercase tracking-[0.6px]"
        style={{ color: palette.label }}
      >
        {label}
      </Text>
      {helper ? (
        <Text className="mt-2 font-nunito-semibold text-[12px] leading-[18px] text-fgMuted">
          {helper}
        </Text>
      ) : null}
    </View>
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
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];
  const palette = {
    info: { bg: tc.infoTint, border: tc.infoBorder, text: tc.infoText },
    warning: {
      bg: tc.secondaryTint,
      border: tc.secondaryBorder,
      text: tc.secondaryText,
    },
    danger: { bg: tc.dangerTint, border: tc.dangerBorder, text: tc.dangerText },
    success: {
      bg: tc.successTint,
      border: tc.successBorder,
      text: tc.successText,
    },
  }[tone];

  return (
    <View
      className="flex-row items-start gap-3 rounded-[22] border px-4 py-4"
      style={{
        backgroundColor: withAlpha(palette.bg, "D9"),
        borderColor: palette.border,
      }}
    >
      <View
        className="mt-[2] h-9 w-9 items-center justify-center rounded-2xl"
        style={{ backgroundColor: withAlpha(palette.text, "1C") }}
      >
        <Ionicons name={icon} size={18} color={palette.text} />
      </View>
      <View className="flex-1 gap-1">
        <Text
          className="font-nunito-extrabold text-[14px]"
          style={{ color: palette.text }}
        >
          {title}
        </Text>
        <Text className="font-nunito-semibold text-[13px] leading-[19px] text-fgMuted">
          {body}
        </Text>
      </View>
    </View>
  );
}

function AdminTopBar({
  title,
  subtitle,
  right,
  chrome = "default",
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  chrome?: "default" | "soft";
}) {
  return (
    <AdminPanel
      chrome={chrome}
      style={{ marginTop: 8, paddingHorizontal: 18, paddingVertical: 16 }}
    >
      <View className="flex-row items-start justify-between gap-4">
        <View className="flex-1 gap-1">
          <Text className="font-nunito-extrabold text-[24px] text-fg">
            {title}
          </Text>
          {subtitle ? (
            <Text className="font-nunito-semibold text-[13px] leading-[19px] text-fgMuted">
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
    </AdminPanel>
  );
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
    <View className="flex-row items-center gap-3">
      <View className="flex-1">
        <Text className="font-nunito-extrabold text-[22px] text-fg">
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-[3] font-nunito-semibold text-xs leading-[18px] text-fgMuted">
            {subtitle}
          </Text>
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
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];
  const [controlWidth, setControlWidth] = useState(0);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selectorProgress = useSharedValue(selectedIndex);
  const selectorWidth =
    controlWidth > 0
      ? Math.max(
          0,
          (controlWidth -
            SEGMENTED_CONTROL_PADDING * 2 -
            SEGMENTED_CONTROL_GAP * Math.max(options.length - 1, 0)) /
            Math.max(options.length, 1),
        )
      : 0;

  useEffect(() => {
    selectorProgress.value = withTiming(selectedIndex, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [selectedIndex, selectorProgress]);

  const selectorTranslateX = useDerivedValue(
    () => selectorProgress.value * (selectorWidth + SEGMENTED_CONTROL_GAP),
  );

  return (
    <View
      className="flex-row gap-2 rounded-[22] border p-2"
      onLayout={({ nativeEvent }) => setControlWidth(nativeEvent.layout.width)}
      style={{
        backgroundColor: withAlpha(tc.surfaceMuted, "E6"),
        borderColor: withAlpha(tc.primaryBorder, "5C"),
        opacity: disabled ? 0.6 : 1,
        position: "relative",
      }}
    >
      {selectorWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          className="absolute bottom-2 left-2 top-2 rounded-[16]"
          style={{
            width: selectorWidth,
            backgroundColor: tc.primaryText,
            transform: [{ translateX: selectorTranslateX }],
          }}
        />
      ) : null}
      {options.map((option) => {
        const active = option.value === value;

        return (
          <Pressable
            key={option.value}
            testID={`admin-segment-${option.value}`}
            onPress={() => {
              if (disabled) {
                return;
              }

              onChange(option.value);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled }}
            className="flex-1 items-center rounded-[16] px-3 py-[11]"
            style={{ zIndex: 1 }}
          >
            <Text
              className="font-nunito-extrabold text-[13px]"
              style={{
                color: active
                  ? pickReadableTextColor(tc.primaryText, tc.fg, tc.surface)
                  : tc.primaryStrong,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
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
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];

  return (
    <Pressable
      className="rounded-full border px-3 py-[9]"
      onPress={onPress}
      style={{
        backgroundColor: selected
          ? withAlpha(tc.primaryTint, "F0")
          : withAlpha(tc.surface, "D9"),
        borderColor: selected
          ? tc.primaryBorder
          : withAlpha(tc.primaryBorder, "47"),
      }}
    >
      <Text
        className="font-nunito-bold text-xs"
        style={{ color: selected ? tc.primaryStrong : tc.fgMuted }}
      >
        {label}
      </Text>
    </Pressable>
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
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];

  return (
    <View
      className="flex-row items-center gap-2 rounded-[20] border px-3 h-[50]"
      style={{
        backgroundColor: withAlpha(tc.surface, "E8"),
        borderColor: withAlpha(tc.primaryBorder, "66"),
      }}
    >
      <Ionicons name="search" size={16} color={tc.muted} />
      <ThemedExpoTextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        hostStyle={{ flex: 1 }}
        style={{ backgroundColor: "transparent", height: 22, width: "100%" }}
        textStyle={{
          color: tc.fg,
          fontFamily: "Nunito-SemiBold",
          fontSize: 14,
        }}
      />
      {value ? (
        <Pressable onPress={() => onChangeText("")}>
          <Ionicons name="close" size={18} color={tc.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

type AdminButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "ghost"
  | "warning";

function getAdminButtonIconColor(tc: ThemeColors, variant: AdminButtonVariant) {
  if (variant === "primary" || variant === "danger") {
    return "#FFFFFF";
  }

  if (variant === "secondary") {
    return tc.secondaryText;
  }

  if (variant === "warning") {
    return tc.accentText;
  }

  return tc.primaryText;
}

export function AdminButton({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled,
  borderRadius,
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
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];
  const iconColor = getAdminButtonIconColor(tc, variant);
  const leadingAccessory = useMemo(
    () =>
      icon ? <Ionicons name={icon} size={16} color={iconColor} /> : undefined,
    [icon, iconColor],
  );
  const fallbackAppearance = {
    ...(variant === "warning"
      ? {
          backgroundColor: tc.accentTint,
          borderColor: tc.accentBorder,
          foregroundColor: tc.accentText,
          gradientColors: null,
        }
      : {}),
    borderRadius: borderRadius ?? 16,
    paddingHorizontal: 15,
    paddingVertical: 10,
    minHeight: 44,
    textStyle: {
      fontFamily: "Nunito_800ExtraBold",
      fontSize: 13,
    },
  };

  return (
    <ThemedExpoButton
      onPress={onPress}
      disabled={disabled}
      label={label}
      leadingAccessory={leadingAccessory}
      fallbackAppearance={fallbackAppearance}
      preferFallback
      style={style ? { minHeight: 44, ...style } : { minHeight: 44 }}
      variant={variant}
    >
      {label}
    </ThemedExpoButton>
  );
}

function getChipPalette(tc: ThemeColors) {
  return {
    default: { bg: tc.surfaceMuted, border: tc.primaryBorder, text: tc.fg },
    success: {
      bg: tc.successTint,
      border: tc.successBorder,
      text: tc.successText,
    },
    info: { bg: tc.infoTint, border: tc.infoBorder, text: tc.infoText },
    accent: { bg: tc.accentTint, border: tc.accentBorder, text: tc.accentText },
    danger: { bg: tc.dangerTint, border: tc.dangerBorder, text: tc.dangerText },
    warning: {
      bg: tc.secondaryTint,
      border: tc.secondaryBorder,
      text: tc.secondaryText,
    },
  };
}

export function AdminChip({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "success" | "info" | "accent" | "danger" | "warning";
}) {
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];
  const palette = getChipPalette(tc)[tone];

  return (
    <View
      className="px-[10] py-[5] rounded-full border"
      style={{ backgroundColor: palette.bg, borderColor: palette.border }}
    >
      <Text
        className="font-nunito-extrabold text-[11px]"
        style={{ color: palette.text }}
      >
        {label}
      </Text>
    </View>
  );
}

export function AbilityTypeChip({
  type,
}: {
  type: "PASSIVE" | "SKILL" | "ULTIMATE";
}) {
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];
  const palette = getAbilityTypePalette(tc, type);
  const { t } = useTranslation();

  return (
    <View
      className="px-[10] py-[5] rounded-full border"
      style={{ backgroundColor: palette.bg, borderColor: palette.border }}
    >
      <Text
        className="font-nunito-extrabold text-[11px]"
        style={{ color: palette.text }}
      >
        {t(`admin.abilities.type.${type}`)}
      </Text>
    </View>
  );
}

function getAdminFieldInputStyle(
  tc: ThemeColors,
  multiline: boolean | undefined,
) {
  return asStyle({
    backgroundColor: tc.surface,
    borderColor: tc.primaryBorder,
    borderRadius: 16,
    borderWidth: 2,
    height: multiline ? undefined : 46,
    paddingHorizontal: 14,
    paddingTop: multiline ? 12 : 0,
    paddingBottom: multiline ? 12 : 0,
    width: "100%",
  });
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
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];

  return (
    <View className="gap-[6]">
      <Text className="font-nunito-bold text-xs text-primaryText">{label}</Text>
      <ThemedExpoTextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        multiline={multiline}
        hostStyle={{
          minHeight: multiline ? 100 : 46,
          width: "100%",
        }}
        style={getAdminFieldInputStyle(tc, multiline)}
        textStyle={{
          color: tc.fg,
          fontFamily: "Nunito-SemiBold",
          fontSize: 14,
          lineHeight: multiline ? 20 : 18,
        }}
        numberOfLines={multiline ? 4 : undefined}
      />
    </View>
  );
}

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
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <KeyboardScreenView>
        <View
          className="flex-1 justify-center p-4"
          style={{ backgroundColor: withAlpha(tc.primaryStrong, "54") }}
        >
          <Pressable style={absoluteFill} onPress={onClose} />
          <View className="max-h-[90%] overflow-hidden rounded-[30]">
            <AdminPanel style={{ paddingHorizontal: 0, paddingVertical: 0 }}>
              <LinearGradient
                colors={[
                  withAlpha(tc.primaryTint, "E8"),
                  withAlpha(tc.surface, "F5"),
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingHorizontal: 18,
                  paddingVertical: 16,
                  justifyContent: "center",
                  alignItems: "center",
                  borderBottomWidth: 1,
                  borderBottomColor: withAlpha(tc.primaryBorder, "47"),
                }}
              >
                <Text className="font-nunito-extrabold text-[18px] text-fg">
                  {title}
                </Text>
                <Pressable
                  onPress={onClose}
                  className="absolute right-[14] top-3 w-8 h-8 rounded-full items-center justify-center"
                  style={{ backgroundColor: withAlpha(tc.surface, "CC") }}
                >
                  <Ionicons name="close" size={18} color={tc.primaryStrong} />
                </Pressable>
              </LinearGradient>
              <ScrollView
                {...KEYBOARD_AWARE_SCROLL_PROPS}
                contentContainerStyle={{ padding: 16, gap: 14 }}
                showsVerticalScrollIndicator={false}
              >
                {children}
              </ScrollView>
            </AdminPanel>
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
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];

  return (
    <View className="items-center gap-2 py-6">
      <View
        className="h-12 w-12 items-center justify-center rounded-[18]"
        style={{ backgroundColor: withAlpha(tc.primaryTint, "CC") }}
      >
        <Ionicons name={icon} size={24} color={tc.primaryText} />
      </View>
      <Text className="font-nunito-extrabold text-[16px] text-fg">{title}</Text>
      <Text className="font-nunito-semibold text-[13px] leading-[19px] text-fgMuted text-center">
        {body}
      </Text>
    </View>
  );
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
