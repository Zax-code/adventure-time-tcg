import { Redirect } from "expo-router";

import { useSessionStore } from "../src/stores/session-store";

export default function IndexScreen() {
  const hydrated = useSessionStore((state) => state.hydrated);
  const user = useSessionStore((state) => state.user);

  if (!hydrated) {
    return null;
  }

  return <Redirect href={user ? "/(tabs)" : "/login"} />;
}
