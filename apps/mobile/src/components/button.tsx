import { ActivityIndicator, Pressable, Text, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useThemeStore } from "../stores/theme-store";
import { THEME_COLORS } from "../theme/themes";

interface ButtonProps {
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function PrimaryButton({ onPress, disabled, loading, children, style }: ButtonProps) {
  const tc = THEME_COLORS[useThemeStore((s) => s.themeName)];
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={style}>
      <LinearGradient
        colors={[tc.primary, tc.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          borderRadius: 999,
          paddingVertical: 12,
          paddingHorizontal: 24,
          alignItems: "center",
          opacity: disabled || loading ? 0.6 : 1,
        }}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: "#fff", fontFamily: "Nunito_700Bold", fontSize: 15 }}>
            {children}
          </Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

export function SecondaryButton({ onPress, disabled, loading, children, style }: ButtonProps) {
  const tc = THEME_COLORS[useThemeStore((s) => s.themeName)];
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={style}>
      <LinearGradient
        colors={[tc.secondary, tc.secondaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          borderRadius: 999,
          paddingVertical: 12,
          paddingHorizontal: 24,
          alignItems: "center",
          opacity: disabled || loading ? 0.6 : 1,
        }}
      >
        {loading ? (
          <ActivityIndicator color={tc.primaryStrong} />
        ) : (
          <Text style={{ color: tc.primaryStrong, fontFamily: "Nunito_700Bold", fontSize: 15 }}>
            {children}
          </Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

export function GhostButton({ onPress, disabled, loading, children, style }: ButtonProps) {
  const tc = THEME_COLORS[useThemeStore((s) => s.themeName)];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        {
          borderRadius: 999,
          paddingVertical: 10,
          paddingHorizontal: 20,
          alignItems: "center",
          borderWidth: 1,
          borderColor: tc.primaryBorder,
          opacity: disabled || loading ? 0.6 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tc.primaryText} />
      ) : (
        <Text style={{ color: tc.primaryText, fontFamily: "Nunito_600SemiBold", fontSize: 14 }}>
          {children}
        </Text>
      )}
    </Pressable>
  );
}
