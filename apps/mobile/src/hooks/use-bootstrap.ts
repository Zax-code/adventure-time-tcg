import { useEffect } from "react";

import { ApiClientError } from "@adventure-time/api-client";

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
  const setHydrated = useSessionStore((state) => state.setHydrated);
  const setSession = useSessionStore((state) => state.setSession);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      await hydrateFromStorage();

      const { accessToken, refreshToken, user } = useSessionStore.getState();

      if (!accessToken || !refreshToken || !user) {
        if (!cancelled) {
          setHydrated(true);
        }
        return;
      }

      try {
        const me = await apiClient.me();
        if (!cancelled) {
          await setSession({ user: me, accessToken, refreshToken });
        }
        return;
      } catch (error) {
        if (!(error instanceof ApiClientError) || error.status !== 401) {
          if (!cancelled) {
            setHydrated(true);
          }
          return;
        }
      }

      try {
        const refreshed = await apiClient.refresh({ refreshToken });
        if (!cancelled) {
          await setSession({
            user: refreshed.user,
            accessToken: refreshed.tokens.accessToken,
            refreshToken: refreshed.tokens.refreshToken,
          });
        }
      } catch (error) {
        if (!cancelled && shouldClearSessionForAuthError(error)) {
          await clearAppSession();
        }
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [hydrateFromStorage, setHydrated, setSession]);
}
