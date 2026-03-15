import { LinearGradient } from "expo-linear-gradient";
import { Text, View } from "react-native";

import { AuthForm } from "../src/components/auth-form";

export default function LoginScreen() {
  return (
    <LinearGradient colors={["#fce7f3", "#fdf2f8", "#f9a8d4"]} style={{ flex: 1 }}>
      <View className="flex-1 justify-center p-5">
        <View className="mb-6 px-2">
          <Text className="font-nunito-extrabold text-4xl text-fg">Welcome back</Text>
          <Text className="mt-2 font-nunito text-base text-fgMuted">
            Sign in with your Adventure Time account or continue with Google.
          </Text>
        </View>
        <AuthForm />
      </View>
    </LinearGradient>
  );
}
