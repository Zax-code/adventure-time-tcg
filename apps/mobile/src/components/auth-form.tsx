import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { apiClient } from "../lib/api";
import { useSessionStore } from "../stores/session-store";

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
    <View className="w-full gap-3 rounded-[24px] bg-orange-50 p-6">
      <Text className="text-3xl font-bold text-amber-900">Adventure Time Native</Text>
      <Text className="text-base text-orange-700">
        Sign in to the new native-first build.
      </Text>
      {mode === "register" ? (
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Display name"
          className="rounded-2xl border border-orange-300 bg-white px-4 py-3"
        />
      ) : null}
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        placeholder="Email"
        className="rounded-2xl border border-orange-300 bg-white px-4 py-3"
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="Password"
        className="rounded-2xl border border-orange-300 bg-white px-4 py-3"
      />
      {error ? <Text className="text-sm text-red-700">{error}</Text> : null}
      <Pressable
        className="items-center rounded-2xl bg-orange-600 px-4 py-4"
        onPress={() => void submit()}
        disabled={loading}
      >
        <Text className="font-bold text-white">
          {loading ? "Working..." : mode === "login" ? "Login" : "Create account"}
        </Text>
      </Pressable>
      <Pressable onPress={() => setMode((current) => (current === "login" ? "register" : "login"))}>
        <Text className="text-center text-sm text-orange-700">
          {mode === "login"
            ? "Need an account? Register"
            : "Already have an account? Login"}
        </Text>
      </Pressable>
    </View>
  );
}
