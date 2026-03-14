import { ActivityIndicator, Pressable, Text, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

interface ButtonProps {
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function PrimaryButton({ onPress, disabled, loading, children, style }: ButtonProps) {
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={style}>
      <LinearGradient
        colors={["#F472B6", "#EC4899"]}
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
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={style}>
      <LinearGradient
        colors={["#FDE047", "#EAB308"]}
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
          <ActivityIndicator color="#BE185D" />
        ) : (
          <Text style={{ color: "#BE185D", fontFamily: "Nunito_700Bold", fontSize: 15 }}>
            {children}
          </Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

export function GhostButton({ onPress, disabled, loading, children, style }: ButtonProps) {
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
          borderColor: "#F9A8D4",
          opacity: disabled || loading ? 0.6 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#DB2777" />
      ) : (
        <Text style={{ color: "#DB2777", fontFamily: "Nunito_600SemiBold", fontSize: 14 }}>
          {children}
        </Text>
      )}
    </Pressable>
  );
}
