import { Platform } from "react-native";

const PRODUCTION_API_BASE_URL = "https://app.leaetzak.love";

function resolveApiBaseUrl(rawBaseUrl: string) {
  let normalizedBaseUrl = rawBaseUrl;

  try {
    const url = new URL(rawBaseUrl);
    const isLocalhostHost =
      url.hostname === "127.0.0.1" || url.hostname === "localhost";

    if (isLocalhostHost && !__DEV__) {
      return PRODUCTION_API_BASE_URL;
    }
  } catch {
    if (!__DEV__) {
      return PRODUCTION_API_BASE_URL;
    }
  }

  if (Platform.OS !== "android") {
    return normalizedBaseUrl;
  }

  try {
    const url = new URL(normalizedBaseUrl);

    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
      return normalizedBaseUrl;
    }

    url.hostname = "10.0.2.2";

    const pathname = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");

    return `${url.origin}${pathname}${url.search}${url.hash}`;
  } catch {
    return normalizedBaseUrl;
  }
}

export const API_BASE_URL = resolveApiBaseUrl(
  process.env.EXPO_PUBLIC_API_BASE_URL ?? PRODUCTION_API_BASE_URL,
);
