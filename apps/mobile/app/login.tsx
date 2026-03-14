import { LinearGradient } from "expo-linear-gradient";
import { View } from "react-native";

import { AuthForm } from "../src/components/auth-form";

export default function LoginScreen() {
  return (
    <LinearGradient colors={["#fef3c7", "#fdba74", "#fb7185"]} style={styles.container}>
      <View className="flex-1 justify-center p-5">
        <AuthForm />
      </View>
    </LinearGradient>
  );
}

const styles = {
  container: {
    flex: 1,
  },
};
