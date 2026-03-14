import { useEffect } from "react";

import { useSessionStore } from "../stores/session-store";

export function useBootstrap() {
  const hydrate = useSessionStore((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);
}
