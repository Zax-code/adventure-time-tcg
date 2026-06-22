import { QueryClient } from "@tanstack/react-query";
import { ZodError } from "zod";

import { ApiClientError, isNetworkError } from "@adventure-time/api-client";

function shouldRetry(failureCount: number, error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status >= 400 && error.status < 500) {
      return false;
    }
  }

  if (error instanceof ZodError) {
    return false;
  }

  if (isNetworkError(error)) {
    return failureCount < 3;
  }

  return failureCount < 1;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      retryDelay: (attemptIndex, error) =>
        isNetworkError(error) ? Math.min(1_000 * 2 ** attemptIndex, 4_000) : 1_000,
      staleTime: 15_000,
      refetchOnMount: (query) =>
        query.state.status === "error" && isNetworkError(query.state.error)
          ? "always"
          : false,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
