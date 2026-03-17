import { Redirect, Slot } from "expo-router";

import { AdminShell } from "../../src/components/admin/admin-shell";
import { useSessionStore } from "../../src/stores/session-store";

export default function AdminLayout() {
  const hydrated = useSessionStore((state) => state.hydrated);
  const user = useSessionStore((state) => state.user);

  if (!hydrated) {
    return null;
  }

  if (!user?.isAdmin) {
    return <Redirect href="/(tabs)/settings" />;
  }

  return (
    <AdminShell>
      <Slot />
    </AdminShell>
  );
}
