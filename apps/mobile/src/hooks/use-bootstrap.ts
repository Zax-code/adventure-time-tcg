import { useEffect } from "react";

import {
  apiClient,
  clearAppSession,
  shouldClearSessionForAuthError,
} from "../lib/api";
import { useSessionStore } from "../stores/session-store";

export function useBootstrap() {
  const hydrateFromStorage = useSessionStore(
    (state) => state.hydrateFromStorage,
  );
  const setBootstrapPhase = useSessionStore((state) => state.setBootstrapPhase);
  const setUser = useSessionStore((state) => state.setUser);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      await hydrateFromStorage();

      const { accessToken, refreshToken, user } = useSessionStore.getState();

      if (!accessToken || !refreshToken || !user) {
        if (!cancelled) {
          setBootstrapPhase("ready");
        }
        return;
      }

      if (!cancelled) {
        setBootstrapPhase("restoring");
      }

      try {
        const me = await apiClient.me();
        if (!cancelled) {
          await setUser(me);
        }
      } catch (error) {
        if (!cancelled && shouldClearSessionForAuthError(error)) {
          await clearAppSession();
        }
      } finally {
        if (!cancelled) {
          setBootstrapPhase("ready");
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [hydrateFromStorage, setBootstrapPhase, setUser]);
}
