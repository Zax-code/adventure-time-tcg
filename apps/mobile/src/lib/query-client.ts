import { QueryClient } from "@tanstack/react-query";
import { ZodError } from "zod";

import { ApiClientError } from "@adventure-time/api-client";

function shouldRetry(failureCount: number, error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status >= 400 && error.status < 500) {
      return false;
    }
  }

  if (error instanceof ZodError) {
    return false;
  }

  return failureCount < 1;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      staleTime: 15_000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
