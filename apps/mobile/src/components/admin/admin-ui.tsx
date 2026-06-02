import { ReactNode, useEffect, useRef, useState } from "react";
import { ModalBottomSheet } from "@swmansion/react-native-bottom-sheet";
import {
  Animated,
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
import {
  KEYBOARD_AWARE_SCROLL_PROPS,
  KeyboardScreenView,
} from "../keyboard-screen-view";
import {
  getAbilityTypePalette,
  pickReadableTextColor,
  type ThemeColors,
  withAlpha,
} from "./admin-palette";
import { ThemedExpoSegmentedControl } from "../expo-ui/themed-segmented-control";
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
}: {
  children: ReactNode;
  style?: ViewStyle;
  tint?: "default" | "primary" | "secondary" | "accent";
}) {
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];
  const backgrounds: Record<typeof tint, string> = {
    default: tc.surface,
    primary: withAlpha(tc.primaryTint, "D9"),
    secondary: withAlpha(tc.secondaryTint, "D9"),
    accent: withAlpha(tc.accentTint, "D9"),
  };

  return (
    <View
      className="overflow-hidden rounded-[28] border px-4 py-4"
      style={[
        {
          backgroundColor: backgrounds[tint],
          borderColor: withAlpha(tc.primaryBorder, "6B"),
          shadowColor: tc.fg,
          shadowOpacity: themeName === "nightosphere" ? 0.24 : 0.08,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 5,
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
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];

  return (
    <AdminPanel style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
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

export function AdminTopBar({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <AdminPanel
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
  return (
    <ThemedExpoSegmentedControl
      value={value}
      options={options}
      onChange={onChange}
      disabled={disabled}
    />
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

function getButtonPalette(tc: ThemeColors) {
  return {
    primary: {
      bg: tc.primary,
      text: pickReadableTextColor(tc.primary, tc.fg, tc.surface),
      border: tc.primaryDark,
    },
    secondary: {
      bg: tc.secondaryTint,
      text: tc.secondaryText,
      border: tc.secondaryBorder,
    },
    danger: {
      bg: tc.dangerDark,
      text: pickReadableTextColor(tc.dangerDark, tc.fg, tc.surface),
      border: tc.dangerDark,
    },
    ghost: {
      bg: withAlpha(tc.surfaceMuted, "F5"),
      text: tc.primaryStrong,
      border: withAlpha(tc.primaryBorder, "73"),
    },
    warning: {
      bg: tc.accentTint,
      text: tc.accentText,
      border: tc.accentBorder,
    },
  };
}

export function AdminButton({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "warning";
  icon?: IoniconName;
  disabled?: boolean;
}) {
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];
  const palette = getButtonPalette(tc)[variant];

  if (!icon) {
    return (
      <ThemedExpoButton
        onPress={onPress}
        disabled={disabled}
        style={{ minHeight: 44 }}
        variant={variant}
      >
        {label}
      </ThemedExpoButton>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="min-h-[44] rounded-[16] border px-[14] flex-row items-center justify-center gap-2"
      style={({ pressed }) => [
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: disabled ? 0.55 : pressed ? 0.88 : 1,
        },
      ]}
    >
      {icon ? <Ionicons name={icon} size={16} color={palette.text} /> : null}
      <Text
        className="font-nunito-extrabold text-[13px]"
        style={{ color: palette.text }}
      >
        {label}
      </Text>
    </Pressable>
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
        style={{
          backgroundColor: tc.surface,
          borderColor: tc.primaryBorder,
          borderRadius: 16,
          borderWidth: 2,
          height: multiline ? undefined : 46,
          paddingHorizontal: 14,
          paddingTop: multiline ? 12 : 0,
          paddingBottom: multiline ? 12 : 0,
          width: "100%",
        }}
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

export function AdminSheet({
  visible,
  title,
  onClose,
  children,
  footer,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [index, setIndex] = useState(visible ? 1 : 0);
  const [mounted, setMounted] = useState(visible);
  const topGap = Math.max(insets.top + 16, 56);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setIndex(1);
      return;
    }

    setIndex(0);
  }, [visible]);

  useEffect(() => {
    if (!visible && index === 0) {
      setMounted(false);
    }
  }, [index, visible]);

  if (!mounted) {
    return null;
  }

  return (
    <ModalBottomSheet
      index={index}
      onIndexChange={setIndex}
      onSettle={(nextIndex) => {
        if (nextIndex === 0 && visible) {
          onClose();
        }
      }}
      detents={[0, "content"]}
      scrimColor={withAlpha(tc.primaryStrong, "54")}
      surface={
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: tc.surface,
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
            },
          ]}
        />
      }
    >
      <KeyboardScreenView fill={false}>
        <View
          style={{
            maxHeight: height - topGap,
            minHeight: Math.min(height - topGap, height * 0.72),
          }}
        >
          <AdminPanel
            style={{ flex: 1, paddingHorizontal: 0, paddingVertical: 0 }}
          >
            <LinearGradient
              colors={[
                withAlpha(tc.primaryTint, "E8"),
                withAlpha(tc.surface, "F5"),
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                paddingHorizontal: 18,
                paddingBottom: 14,
                paddingTop: 8,
                justifyContent: "center",
                alignItems: "center",
                borderBottomWidth: 1,
                borderBottomColor: withAlpha(tc.primaryBorder, "47"),
              }}
            >
              <View className="w-full items-center pb-2">
                <View
                  className="w-[54] h-[5] rounded-full"
                  style={{ backgroundColor: withAlpha(tc.primaryStrong, "2B") }}
                />
              </View>
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
              contentContainerStyle={{
                padding: 16,
                paddingBottom: 28,
                gap: 14,
              }}
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
            {footer ? (
              <View
                className="border-t px-4 pt-3 pb-4"
                style={{
                  borderTopColor: withAlpha(tc.primaryBorder, "47"),
                  backgroundColor: tc.surface,
                }}
              >
                {footer}
              </View>
            ) : null}
          </AdminPanel>
        </View>
      </KeyboardScreenView>
    </ModalBottomSheet>
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
