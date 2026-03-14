import * as SecureStore from "expo-secure-store";

import { ApiClient } from "@adventure-time/api-client";

import { useSessionStore } from "../stores/session-store";

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://app.leaetzak.love";

export async function getAccessToken() {
  return useSessionStore.getState().accessToken ?? (await SecureStore.getItemAsync("accessToken"));
}

export const apiClient = new ApiClient({
  baseUrl: API_BASE_URL,
  getAccessToken,
});
