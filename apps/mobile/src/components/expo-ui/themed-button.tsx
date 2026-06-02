import { type ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { Button as ComposeButton, FilledTonalButton, Host as ComposeHost, Text as ComposeText, TextButton } from "@expo/ui/jetpack-compose";
import { Button as SwiftButton, Host as SwiftHost, Text as SwiftText } from "@expo/ui/swift-ui";
import {
  buttonStyle,
  controlSize,
  disabled as swiftDisabled,
  font,
  foregroundStyle,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { LinearGradient } from "expo-linear-gradient";

import { useThemeStore } from "../../stores/theme-store";
import {
  getExpoUIColorScheme,
  THEME_COLORS,
} from "../../theme/themes";

type ThemedButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "ghost"
  | "warning";

type ThemedButtonFallbackAppearance = {
  backgroundColor?: string;
  borderColor?: string;
  foregroundColor?: string;
  borderRadius?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;
  minHeight?: number;
  gradientColors?: readonly [string, string] | null;
  textStyle?: {
    fontFamily?: string;
    fontSize?: number;
  };
};

type ThemedExpoButtonProps = {
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  children?: ReactNode;
  label?: string;
  leadingAccessory?: ReactNode;
  fallbackAppearance?: ThemedButtonFallbackAppearance;
  style?: ViewStyle;
  variant: ThemedButtonVariant;
};

function getButtonPalette(
  tc: (typeof THEME_COLORS)[keyof typeof THEME_COLORS],
  variant: ThemedButtonVariant,
) {
  switch (variant) {
    case "danger":
      return {
        filledBackground: tc.dangerDark,
        filledForeground: "#FFFFFF",
        tonalBackground: tc.dangerTint,
        tonalForeground: tc.dangerText,
        outlineForeground: tc.dangerText,
        outlineBorder: tc.dangerBorder,
      };
    case "secondary":
      return {
        filledBackground: tc.secondary,
        filledForeground: tc.primaryStrong,
        tonalBackground: tc.secondaryTint,
        tonalForeground: tc.secondaryText,
        outlineForeground: tc.secondaryText,
        outlineBorder: tc.secondaryBorder,
      };
    case "ghost":
      return {
        filledBackground: tc.surface,
        filledForeground: tc.primaryText,
        tonalBackground: tc.surfaceMuted,
        tonalForeground: tc.primaryText,
        outlineForeground: tc.primaryText,
        outlineBorder: tc.primaryBorder,
      };
    case "warning":
      return {
        filledBackground: tc.accentText,
        filledForeground: "#FFFFFF",
        tonalBackground: tc.accentTint,
        tonalForeground: tc.accentText,
        outlineForeground: tc.accentText,
        outlineBorder: tc.accentBorder,
      };
    default:
      return {
        filledBackground: tc.primary,
        filledForeground: "#FFFFFF",
        tonalBackground: tc.primaryTint,
        tonalForeground: tc.primaryStrong,
        outlineForeground: tc.primaryText,
        outlineBorder: tc.primaryBorder,
      };
  }
}

function getLabelText(label: string | undefined, children: ReactNode | undefined) {
  if (label) {
    return label;
  }

  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }

  return null;
}

function shouldUseFallbackButton(
  label: string | null,
  loading: boolean | undefined,
  leadingAccessory: ReactNode | undefined,
  style: ViewStyle | undefined,
) {
  if (Platform.OS === "web" || loading || !label || leadingAccessory) {
    return true;
  }

  return Boolean(
    style?.flex != null ||
      style?.flexGrow != null ||
      style?.flexBasis != null ||
      style?.alignSelf === "stretch" ||
      style?.width != null
  );
}

function getNativeButtonKind(variant: ThemedButtonVariant) {
  if (variant === "ghost") {
    return "ghost";
  }

  if (variant === "secondary" || variant === "warning") {
    return "tonal";
  }

  return "filled";
}

function getDefaultFallbackAppearance(
  tc: (typeof THEME_COLORS)[keyof typeof THEME_COLORS],
  palette: ReturnType<typeof getButtonPalette>,
  nativeKind: ReturnType<typeof getNativeButtonKind>,
  variant: ThemedButtonVariant,
): Required<Omit<ThemedButtonFallbackAppearance, "textStyle">> & {
  textStyle: NonNullable<ThemedButtonFallbackAppearance["textStyle"]>;
} {
  return {
    backgroundColor:
      nativeKind === "ghost"
        ? "transparent"
        : nativeKind === "tonal"
          ? palette.tonalBackground
          : palette.filledBackground,
    borderColor:
      nativeKind === "ghost" ? tc.primaryBorder : palette.outlineBorder,
    foregroundColor:
      nativeKind === "tonal"
        ? palette.tonalForeground
        : nativeKind === "ghost"
          ? palette.outlineForeground
          : palette.filledForeground,
    borderRadius: 999,
    paddingHorizontal: nativeKind === "ghost" ? 20 : 24,
    paddingVertical: nativeKind === "ghost" ? 10 : 12,
    minHeight: 0,
    gradientColors:
      nativeKind === "ghost"
        ? null
        : variant === "secondary"
          ? ([tc.secondary, tc.secondaryDark] as const)
          : variant === "danger"
            ? ([tc.dangerDark, tc.dangerDark] as const)
            : variant === "warning"
              ? ([tc.accentText, tc.accentText] as const)
              : ([tc.primary, tc.primaryDark] as const),
    textStyle: {
      fontFamily:
        variant === "ghost" ? "Nunito_600SemiBold" : "Nunito_700Bold",
      fontSize: variant === "ghost" ? 14 : 15,
    },
  };
}

function FallbackButton({
  onPress,
  disabled,
  loading,
  children,
  label: explicitLabel,
  leadingAccessory,
  fallbackAppearance,
  style,
  variant,
}: ThemedExpoButtonProps) {
  const tc = THEME_COLORS[useThemeStore((state) => state.themeName)];
  const palette = getButtonPalette(tc, variant);
  const nativeKind = getNativeButtonKind(variant);
  const label = getLabelText(explicitLabel, children);
  const defaultAppearance = getDefaultFallbackAppearance(
    tc,
    palette,
    nativeKind,
    variant,
  );
  const appearance = {
    ...defaultAppearance,
    ...fallbackAppearance,
    textStyle: {
      ...defaultAppearance.textStyle,
      ...fallbackAppearance?.textStyle,
    },
  };
  const foregroundColor = appearance.foregroundColor;
  const content = loading ? (
    <ActivityIndicator color={foregroundColor} />
  ) : (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: leadingAccessory ? 8 : 0,
      }}
    >
      {leadingAccessory}
      {label ? (
        <Text
          style={{
            color: foregroundColor,
            fontFamily: appearance.textStyle.fontFamily,
            fontSize: appearance.textStyle.fontSize,
          }}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        {
          borderRadius: appearance.borderRadius,
          paddingVertical:
            appearance.gradientColors == null
              ? appearance.paddingVertical
              : undefined,
          paddingHorizontal:
            appearance.gradientColors == null
              ? appearance.paddingHorizontal
              : undefined,
          minHeight:
            appearance.gradientColors == null
              ? appearance.minHeight || undefined
              : undefined,
          backgroundColor:
            appearance.gradientColors == null
              ? appearance.backgroundColor
              : undefined,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: appearance.gradientColors == null ? 1 : 0,
          borderColor:
            appearance.gradientColors == null
              ? appearance.borderColor
              : undefined,
          opacity: disabled || loading ? 0.6 : 1,
        },
        style,
      ]}
    >
      {appearance.gradientColors ? (
        <LinearGradient
          colors={appearance.gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            borderRadius: appearance.borderRadius,
            paddingVertical: appearance.paddingVertical,
            paddingHorizontal: appearance.paddingHorizontal,
            minHeight: appearance.minHeight || undefined,
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
          }}
        >
          {content}
        </LinearGradient>
      ) : (
        content
      )}
    </Pressable>
  );
}

export function ThemedExpoButton(props: ThemedExpoButtonProps) {
  const {
    style,
    loading,
    children,
    label: explicitLabel,
    leadingAccessory,
    disabled,
    onPress,
    variant,
  } = props;
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const colorScheme = getExpoUIColorScheme(themeName);
  const label = getLabelText(explicitLabel, children);
  const palette = getButtonPalette(tc, variant);
  const nativeKind = getNativeButtonKind(variant);

  if (shouldUseFallbackButton(label, loading, leadingAccessory, style)) {
    return <FallbackButton {...props} />;
  }

  if (Platform.OS === "ios") {
    const iosButtonStyle =
      nativeKind === "ghost"
        ? "bordered"
        : nativeKind === "tonal"
          ? "bordered"
          : "borderedProminent";

    return (
      <SwiftHost colorScheme={colorScheme} matchContents style={style}>
        <SwiftButton
          onPress={disabled ? undefined : onPress}
          modifiers={[
            buttonStyle(iosButtonStyle),
            controlSize("large"),
            tint(
              nativeKind === "tonal"
                ? palette.tonalBackground
                : palette.filledBackground,
            ),
            swiftDisabled(disabled),
          ]}
        >
          <SwiftText
            modifiers={[
              font({
                family: variant === "ghost" ? "Nunito_600SemiBold" : "Nunito_700Bold",
                size: variant === "ghost" ? 14 : 15,
              }),
              foregroundStyle(
                nativeKind === "tonal"
                  ? palette.tonalForeground
                  : nativeKind === "ghost"
                    ? palette.outlineForeground
                    : palette.filledForeground,
              ),
            ]}
          >
            {label}
          </SwiftText>
        </SwiftButton>
      </SwiftHost>
    );
  }

  if (Platform.OS === "android") {
    const ButtonComponent =
      nativeKind === "ghost"
        ? TextButton
        : nativeKind === "tonal"
          ? FilledTonalButton
          : ComposeButton;

    return (
      <ComposeHost colorScheme={colorScheme} seedColor={tc.primary} matchContents style={style}>
        <ButtonComponent
          onClick={disabled ? undefined : onPress}
          enabled={!disabled}
          colors={{
            containerColor:
              nativeKind === "tonal"
                ? palette.tonalBackground
                : palette.filledBackground,
            contentColor:
              nativeKind === "tonal"
                ? palette.tonalForeground
                : nativeKind === "ghost"
                  ? palette.outlineForeground
                  : palette.filledForeground,
            disabledContainerColor: tc.primaryBorder,
            disabledContentColor:
              nativeKind === "filled" ? "#FFFFFF" : tc.fgMuted,
          }}
          contentPadding={{ start: 24, end: 24, top: 12, bottom: 12 }}
        >
          <ComposeText
            color={
              nativeKind === "tonal"
                ? palette.tonalForeground
                : nativeKind === "ghost"
                  ? palette.outlineForeground
                  : palette.filledForeground
            }
            style={{
              fontFamily:
                variant === "ghost" ? "Nunito_600SemiBold" : "Nunito_700Bold",
              fontSize: variant === "ghost" ? 14 : 15,
            }}
          >
            {label}
          </ComposeText>
        </ButtonComponent>
      </ComposeHost>
    );
  }

  return <FallbackButton {...props} />;
}
