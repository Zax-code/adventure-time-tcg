import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthUser } from "@adventure-time/api-client";

import { webApiClient } from "../lib/api";
import {
  clearLocalWebSession,
  createWebSession,
  getAccessToken,
  getAuthSnapshot,
  restoreWebSession,
} from "./session";

const user: AuthUser = {
  id: "user-1",
  email: "finn@example.com",
  displayName: "Finn",
  avatarAssetId: null,
  coins: 50,
  dust: 10,
  authMethods: { password: true, google: false, apple: false },
  isAdmin: false,
  isSuperAdmin: false,
  preferredStepSource: "device_health",
  preferredLanguage: "en",
  timezone: "America/New_York",
  notificationPreferences: {
    dailyReset: true,
    stepGoal: true,
    pvpInvite: true,
    pvpTurn: true,
    giftReceived: true,
  },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("web session", () => {
  beforeEach(() => {
    clearLocalWebSession();
    vi.restoreAllMocks();
  });

  it("restores a cookie-backed session once when callers race", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ user, accessToken: "access-1" }));

    const [first, second] = await Promise.all([
      restoreWebSession(),
      restoreWebSession(),
    ]);

    expect(first).toEqual(user);
    expect(second).toEqual(user);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/web/session/refresh",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: "{}",
      }),
    );
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("X-Adventure-Time-Web")).toBe("1");
    expect(getAccessToken()).toBe("access-1");
    expect(getAuthSnapshot()).toMatchObject({
      status: "authenticated",
      user,
      restoreError: null,
    });
  });

  it("creates a session without persisting the access token in browser storage", async () => {
    const localStorageSpy = vi.spyOn(Storage.prototype, "setItem");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ user, accessToken: "access-2" }));

    await createWebSession({
      email: "finn@example.com",
      password: "adventure",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/web/session",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          email: "finn@example.com",
          password: "adventure",
        }),
      }),
    );
    expect(getAccessToken()).toBe("access-2");
    expect(localStorageSpy).not.toHaveBeenCalled();
  });

  it("settles as anonymous when no refresh cookie is present", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ error: "No web session" }, 401),
    );

    await expect(restoreWebSession()).resolves.toBeNull();
    expect(getAuthSnapshot()).toMatchObject({
      status: "anonymous",
      user: null,
      restoreError: null,
    });
    expect(getAccessToken()).toBeNull();
  });

  it("refreshes the in-memory token once and retries an authenticated API request", async () => {
    let meRequests = 0;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input) => {
        const url = String(input);
        if (url.endsWith("/web/session")) {
          return jsonResponse({ user, accessToken: "access-old" });
        }
        if (url.endsWith("/web/session/refresh")) {
          return jsonResponse({ user, accessToken: "access-new" });
        }
        if (url.endsWith("/me")) {
          meRequests += 1;
          return meRequests === 1
            ? jsonResponse({ error: "Expired" }, 401)
            : jsonResponse(user);
        }
        throw new Error(`Unexpected request: ${url}`);
      },
    );

    await createWebSession({
      email: "finn@example.com",
      password: "adventure",
    });
    await expect(webApiClient.me()).resolves.toEqual(user);

    expect(meRequests).toBe(2);
    expect(getAccessToken()).toBe("access-new");
    const retry = fetchMock.mock.calls.filter(([input]) =>
      String(input).endsWith("/me"),
    )[1];
    expect(retry?.[1]?.headers).toEqual(
      expect.objectContaining({
        Accept: "application/json",
        Authorization: "Bearer access-new",
        "X-Adventure-Time-Web": "1",
      }),
    );
  });
});
