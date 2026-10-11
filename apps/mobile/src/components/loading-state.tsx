import { View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";

import type { IoniconName } from "../lib/ionicons";
import { StatePanel } from "./ui/state-panel";

type LoadingVariant = "page" | "section";

// Loading uses the StatePanel layout (board 02). `icon` names the feature the
// screen belongs to and shows on page-level loaders.
export function LoadingPanel({
  title,
  message,
  icon = "sparkles",
  variant = "section",
}: {
  title: string;
  message?: string;
  icon?: IoniconName;
  variant?: LoadingVariant;
}) {
  return (
    <View className={variant === "page" ? "w-full max-w-[380px]" : "w-full"}>
      <StatePanel
        variant="loading"
        title={title}
        body={message}
        icon={({ color, size }: { color: string; size: number }) => (
          <Ionicons name={icon} size={size} color={color} />
        )}
      />
    </View>
  );
}

export function PageLoadingState({
  title,
  message,
  icon = "sparkles",
}: {
  title: string;
  message?: string;
  icon?: IoniconName;
}) {
  return (
    <View className="flex-1 items-center justify-center bg-bg px-ds-6">
      <LoadingPanel title={title} message={message} icon={icon} variant="page" />
    </View>
  );
}
