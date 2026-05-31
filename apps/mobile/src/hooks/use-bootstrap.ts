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
  const setBootstrapPhase = useSessionStore((state) => state.setBootstrapPhase);
  const setSession = useSessionStore((state) => state.setSession);
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
          // `/me` may have already rotated tokens via the API client's auto-refresh path.
          await setUser(me);
        }
        return;
      } catch (error) {
        if (!(error instanceof ApiClientError) || error.status !== 401) {
          if (!cancelled) {
            setBootstrapPhase("ready");
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
          setBootstrapPhase("ready");
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [hydrateFromStorage, setBootstrapPhase, setSession, setUser]);
}
