import { useEffect } from "react";
import { AppState } from "react-native";

import { queryClient } from "../lib/query-client";
import { isNetworkError } from "../lib/api";

export function useRetryFailedQueriesOnAppActive() {
  useEffect(() => {
    let currentState = AppState.currentState;

    const subscription = AppState.addEventListener("change", (nextState) => {
      const becameActive =
        currentState.match(/inactive|background/) && nextState === "active";

      currentState = nextState;

      if (!becameActive) {
        return;
      }

      void queryClient.refetchQueries({
        predicate: (query) =>
          query.state.status === "error" &&
          isNetworkError(query.state.error),
      });
    });

    return () => {
      subscription.remove();
    };
  }, []);
}
