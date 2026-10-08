import { useCallback } from "react";
import { useIsFocused } from "expo-router";

type PolledQuery = { state: { status: string } };

/**
 * Polls only while the screen is focused and the last fetch did not fail.
 * Tab screens stay mounted when blurred, so a bare `refetchInterval` keeps
 * polling from every other tab.
 */
export function useFocusedRefetchInterval<TQuery extends PolledQuery = PolledQuery>(
  intervalMs: number,
  shouldPoll?: (query: TQuery) => boolean,
) {
  const focused = useIsFocused();

  return useCallback(
    (query: TQuery) =>
      focused &&
      query.state.status !== "error" &&
      (shouldPoll ? shouldPoll(query) : true)
        ? intervalMs
        : false,
    [focused, intervalMs, shouldPoll],
  );
}
