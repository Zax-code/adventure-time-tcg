import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { apiClient } from "./api";
import { queryClient } from "./query-client";

WebBrowser.maybeCompleteAuthSession();

const APP_SCHEME = "adventure-time";

type FitbitConnectResult =
  | { type: "success" }
  | { type: "cancel" | "dismiss" }
  | { type: "error"; reason: string };

export async function connectFitbit(redirectPath = "/settings"): Promise<FitbitConnectResult> {
  const redirectUri = Linking.createURL(redirectPath, {
    scheme: APP_SCHEME,
  });
  const { authorizeUrl } = await apiClient.createFitbitAuthorizeUrl({
    redirectUri,
  });

  const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, redirectUri);

  if (result.type !== "success") {
    return {
      type:
        result.type === "cancel" || result.type === "dismiss"
          ? result.type
          : "dismiss",
    };
  }

  const queryParams = Linking.parse(result.url).queryParams ?? {};
  const fitbitStatus = firstValue(queryParams.fitbit);

  if (fitbitStatus === "connected") {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["quests"] }),
      queryClient.invalidateQueries({ queryKey: ["fitbit-status"] }),
      queryClient.invalidateQueries({ queryKey: ["health-steps"] }),
      queryClient.invalidateQueries({ queryKey: ["home"] }),
    ]);

    return { type: "success" };
  }

  return {
    type: "error",
    reason: firstValue(queryParams.reason) || "unknown_error",
  };
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
