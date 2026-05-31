import { ReactNode, useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import { LoadingPanel } from "../loading-state";
import {
  KEYBOARD_AWARE_SCROLL_PROPS,
  KeyboardScreenView,
} from "../keyboard-screen-view";
import { ADMIN_TYPE_COLORS } from "./admin-theme";
import { useTranslation } from "../../i18n";
import { useThemeStore } from "../../stores/theme-store";
import { THEME_COLORS } from "../../theme/themes";

const absoluteFill = {
  position: "absolute" as const,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

export function AdminBackground({ children }: { children: ReactNode }) {
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];
  return (
    <LinearGradient
      colors={[tc.primaryTint, tc.secondaryTint]}
      style={absoluteFill}
    >
      <View className="absolute top-20 -left-10 w-[180] h-[180] rounded-full bg-white/35" />
      <View className="absolute top-[180] -right-[30] w-[140] h-[140] rounded-full bg-secondary/18" />
      <View className="absolute bottom-[140] left-[60] w-[120] h-[120] rounded-full bg-primary/12" />
      {children}
    </LinearGradient>
  );
}

export function AdminPanel({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];
  return (
    <View
      className="bg-surfaceMuted rounded-3xl border border-primaryBorder/30 p-4"
      style={[
        {
          shadowColor: tc.primaryStrong,
          shadowOpacity: 0.18,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        },
        style,
      ]}
    >
      {children}
    </View>
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
        <Text className="font-nunito-extrabold text-[22px] text-primaryStrong">
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-[3] font-nunito-semibold text-xs text-fgMuted">
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
        paddingBottom: 128,
        gap: 16,
      }}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
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
    <View className="flex-row items-center gap-2 rounded-full border border-primaryBorder/30 bg-surface/85 px-3 h-[46]">
      <Ionicons name="search" size={16} color={tc.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tc.muted}
        className="flex-1 font-nunito-semibold text-fg text-sm"
      />
      {value ? (
        <Pressable onPress={() => onChangeText("")}>
          <Ionicons name="close" size={18} color={tc.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

function getButtonPalette(
  tc: (typeof THEME_COLORS)[keyof typeof THEME_COLORS],
) {
  return {
    primary: { bg: tc.primaryText, text: "#FFFFFF" },
    secondary: { bg: tc.secondaryTint, text: tc.secondaryText },
    danger: { bg: tc.dangerDark, text: "#FFFFFF" },
    ghost: { bg: tc.surfaceMuted, text: tc.primaryStrong },
    warning: { bg: tc.secondaryDark, text: tc.secondaryText },
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
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
}) {
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];
  const palette = getButtonPalette(tc)[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="min-h-[42] rounded-[14] px-[14] flex-row items-center justify-center gap-2"
      style={({ pressed }) => [
        {
          backgroundColor: palette.bg,
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

function getChipPalette(tc: (typeof THEME_COLORS)[keyof typeof THEME_COLORS]) {
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
  const palette = ADMIN_TYPE_COLORS[type];
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
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tc.muted}
        keyboardType={keyboardType}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        className={`rounded-2xl border-2 border-primaryBorder bg-surface px-[14] text-fg font-nunito-semibold text-sm${multiline ? " min-h-[100] pt-3" : " min-h-[46]"}`}
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
          style={{ backgroundColor: tc.primaryStrong + "47" }}
        >
          <Pressable style={absoluteFill} onPress={onClose} />
          <View
            className="max-h-[90%] rounded-[28] overflow-hidden"
            style={{ backgroundColor: tc.surface }}
          >
            <LinearGradient
              colors={[tc.primary, tc.primaryText]}
              style={{
                paddingHorizontal: 18,
                paddingVertical: 16,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text className="text-white font-nunito-extrabold text-[18px]">
                {title}
              </Text>
              <Pressable
                onPress={onClose}
                className="absolute right-[14] top-3 w-8 h-8 rounded-full items-center justify-center"
                style={{ backgroundColor: "rgba(255,255,255,0.16)" }}
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </Pressable>
            </LinearGradient>
            <ScrollView
              {...KEYBOARD_AWARE_SCROLL_PROPS}
              contentContainerStyle={{ padding: 16, gap: 14 }}
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
  const translateY = useRef(new Animated.Value(0)).current;
  const closingRef = useRef(false);

  const closeAnimated = () => {
    if (closingRef.current) {
      return;
    }

    closingRef.current = true;
    Animated.timing(translateY, {
      toValue: 720,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      closingRef.current = false;
      translateY.setValue(0);
      onClose();
    });
  };

  useEffect(() => {
    if (!visible) {
      translateY.setValue(0);
      closingRef.current = false;
    }
  }, [translateY, visible]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          gestureState.dy > 8 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            translateY.setValue(gestureState.dy);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 140 || gestureState.vy > 1.1) {
            closeAnimated();
            return;
          }

          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        },
      }),
    [translateY],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={closeAnimated}
    >
      <KeyboardScreenView>
        <View
          className="flex-1 justify-end"
          style={{ backgroundColor: tc.primaryStrong + "47" }}
        >
          <Pressable style={absoluteFill} onPress={closeAnimated} />
          <Animated.View
            className="min-h-[88%] max-h-[96%] rounded-tl-[30] rounded-tr-[30] overflow-hidden"
            style={[
              { backgroundColor: tc.surface, transform: [{ translateY }] },
            ]}
          >
            <LinearGradient
              colors={[tc.primary, tc.primaryText]}
              style={{
                paddingHorizontal: 18,
                paddingBottom: 14,
                paddingTop: 8,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <View
                {...panResponder.panHandlers}
                className="w-full items-center pb-2"
              >
                <View
                  className="w-[54] h-[5] rounded-full"
                  style={{ backgroundColor: "rgba(255,255,255,0.6)" }}
                />
              </View>
              <Text className="text-white font-nunito-extrabold text-[18px]">
                {title}
              </Text>
              <Pressable
                onPress={closeAnimated}
                className="absolute right-[14] top-3 w-8 h-8 rounded-full items-center justify-center"
                style={{ backgroundColor: "rgba(255,255,255,0.16)" }}
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
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
                className="px-4 pt-3 pb-4 border-t"
                style={{
                  borderTopColor: tc.primaryBorder + "24",
                  backgroundColor: tc.surface,
                }}
              >
                {footer}
              </View>
            ) : null}
          </Animated.View>
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
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];
  return (
    <View className="items-center gap-2 py-6">
      <Ionicons name={icon} size={28} color={tc.primaryText} />
      <Text className="font-nunito-extrabold text-[16px] text-primaryStrong">
        {title}
      </Text>
      <Text className="font-nunito-semibold text-[13px] text-fgMuted text-center">
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
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return <LoadingPanel title={title} message={body} icon={icon} />;
}
