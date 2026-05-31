import { Platform } from "react-native";

function resolveApiBaseUrl(rawBaseUrl: string) {
  if (Platform.OS !== "android") {
    return rawBaseUrl;
  }

  try {
    const url = new URL(rawBaseUrl);

    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
      return rawBaseUrl;
    }

    url.hostname = "10.0.2.2";

    const pathname = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");

    return `${url.origin}${pathname}${url.search}${url.hash}`;
  } catch {
    return rawBaseUrl;
  }
}

export const API_BASE_URL = resolveApiBaseUrl(
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://app.leaetzak.love",
);
