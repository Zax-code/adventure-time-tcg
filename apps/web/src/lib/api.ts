import { QueryClient } from "@tanstack/react-query";

import {
  ApiClient,
  ApiClientError,
  isNetworkError,
} from "@adventure-time/api-client";

export const API_BASE_URL = import.meta.env.DEV ? "/api" : "";

type WebAuthAdapters = {
  getAccessToken: () => string | null | Promise<string | null>;
  refreshAccessToken: () => Promise<string | null>;
  onAuthFailure: () => void | Promise<void>;
};

let webAuthAdapters: WebAuthAdapters = {
  getAccessToken: () => null,
  refreshAccessToken: async () => null,
  onAuthFailure: () => undefined,
};

export class WebApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "WebApiError";
  }
}

export function configureWebApiAuth(adapters: WebAuthAdapters) {
  webAuthAdapters = adapters;
}

function getWebHeaders() {
  return {
    Accept: "application/json",
    "X-Adventure-Time-Client": "web",
    "X-Adventure-Time-Platform": "web",
    "X-Adventure-Time-Web": "1",
  };
}

export const webApiClient = new ApiClient({
  baseUrl: API_BASE_URL,
  getAccessToken: () => webAuthAdapters.getAccessToken(),
  getClientHeaders: getWebHeaders,
  refreshAccessToken: () => webAuthAdapters.refreshAccessToken(),
  onAuthFailure: () => webAuthAdapters.onAuthFailure(),
});

function toErrorDetails(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

export async function webJsonRequest<T>(
  path: string,
  init: RequestInit,
  parse: (data: unknown) => T,
): Promise<T> {
  const headers = new Headers(init.headers);
  const webHeaders = getWebHeaders();

  Object.entries(webHeaders).forEach(([name, value]) => {
    headers.set(name, value);
  });
  headers.set("Content-Type", "application/json");

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers,
    });
  } catch (error) {
    throw new WebApiError(
      error instanceof Error && error.message
        ? error.message
        : "Unable to reach Adventure Time TCG.",
      0,
      "NETWORK_ERROR",
    );
  }

  const data =
    response.status === 204
      ? null
      : await response.json().catch(() => null);

  if (!response.ok) {
    const details = toErrorDetails(data);
    const message =
      typeof details?.error === "string"
        ? details.error
        : `Request failed with status ${response.status}.`;
    const code = typeof details?.code === "string" ? details.code : undefined;

    throw new WebApiError(message, response.status, code, details);
  }

  return parse(data);
}

export function isAuthenticationError(error: unknown) {
  return (
    (error instanceof WebApiError || error instanceof ApiClientError) &&
    (error.status === 401 || error.status === 403)
  );
}

export function getErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function shouldRetryQuery(failureCount: number, error: unknown) {
  if (failureCount >= 2) {
    return false;
  }

  if (error instanceof WebApiError) {
    return error.status === 0 || error.status >= 500;
  }

  return isNetworkError(error);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: shouldRetryQuery,
      staleTime: 30_000,
    },
    mutations: {
      retry: false,
    },
  },
});
