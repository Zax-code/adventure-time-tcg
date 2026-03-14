import { LinearGradient } from "expo-linear-gradient";
import { View } from "react-native";

import { AuthForm } from "../src/components/auth-form";

export default function LoginScreen() {
  return (
    <LinearGradient colors={["#fce7f3", "#fdf2f8", "#f9a8d4"]} style={{ flex: 1 }}>
      <View className="flex-1 justify-center p-5">
        <AuthForm />
      </View>
    </LinearGradient>
  );
}
