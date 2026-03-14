import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { apiClient } from "../lib/api";
import { useSessionStore } from "../stores/session-store";
import { PrimaryButton } from "./button";

export function AuthForm() {
  const router = useRouter();
  const setSession = useSessionStore((state) => state.setSession);
  const [displayName, setDisplayName] = useState("Finn Fan");
  const [email, setEmail] = useState("finn@example.com");
  const [password, setPassword] = useState("password123");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);

    try {
      const result =
        mode === "login"
          ? await apiClient.login({ email, password })
          : await apiClient.register({ email, password, displayName });

      await setSession({
        user: result.user,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
      });
      router.replace("/(tabs)");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Authentication failed",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="w-full gap-3 rounded-3xl border border-primaryBorder bg-white p-6">
      <Text className="font-nunito-extrabold text-3xl text-fg">Adventure Time</Text>
      <Text className="font-nunito text-base text-fgMuted">
        Sign in to the new native-first build.
      </Text>
      {mode === "register" ? (
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Display name"
          placeholderTextColor="#9CA3AF"
          className="rounded-2xl border border-primaryBorder bg-primaryBg px-4 py-3 font-nunito text-fg"
        />
      ) : null}
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        placeholder="Email"
        placeholderTextColor="#9CA3AF"
        className="rounded-2xl border border-primaryBorder bg-primaryBg px-4 py-3 font-nunito text-fg"
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="Password"
        placeholderTextColor="#9CA3AF"
        className="rounded-2xl border border-primaryBorder bg-primaryBg px-4 py-3 font-nunito text-fg"
      />
      {error ? <Text className="text-sm text-red-700">{error}</Text> : null}
      <PrimaryButton onPress={() => void submit()} loading={loading}>
        {mode === "login" ? "Login" : "Create account"}
      </PrimaryButton>
      <Pressable onPress={() => setMode((current) => (current === "login" ? "register" : "login"))}>
        <Text className="text-center font-nunito text-sm text-primaryText">
          {mode === "login"
            ? "Need an account? Register"
            : "Already have an account? Login"}
        </Text>
      </Pressable>
    </View>
  );
}
