import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthUser } from "@adventure-time/api-client";

import { AuthProvider } from "../../auth/auth-provider";
import { clearLocalWebSession } from "../../auth/session";
import { LoginPage } from "./login-page";

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

function renderLogin(homeHeading: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/home" element={<h1>{homeHeading}</h1>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    clearLocalWebSession();
  });

  afterEach(() => {
    delete window.google;
    delete window.AppleID;
    vi.restoreAllMocks();
  });

  it("creates a browser session and continues to the signed-in home", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input) => {
        const url = String(input);
        if (url.endsWith("/web/session/refresh")) {
          return jsonResponse({ error: "No session" }, 401);
        }

        if (url.endsWith("/web/auth/config")) {
          return jsonResponse({ googleClientId: null, apple: null });
        }

        if (url.endsWith("/web/session")) {
          return jsonResponse({ user, accessToken: "access-token" });
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    renderLogin("Signed-in home");

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "finn@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "adventure" },
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    });
    fireEvent.submit(screen.getByRole("form", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Signed-in home" })).toBeVisible();
    await waitFor(() => {
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
    });
  });

  it("turns a Google credential into the cookie-backed browser session", async () => {
    const requestAccessToken = vi.fn();
    window.google = {
      accounts: {
        oauth2: {
          initTokenClient: vi.fn((options) => {
            requestAccessToken.mockImplementation(() => {
              options.callback({ access_token: "google-provider-token" });
            });
            return { requestAccessToken };
          }),
        },
      },
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input) => {
        const url = String(input);
        if (url.endsWith("/web/auth/config")) {
          return jsonResponse({
            googleClientId: "google-browser-client",
            apple: null,
          });
        }

        if (url.endsWith("/web/session/google")) {
          return jsonResponse({
            user: {
              ...user,
              authMethods: { password: false, google: true, apple: false },
            },
            accessToken: "web-access-token",
          });
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    renderLogin("Provider home");

    fireEvent.click(
      await screen.findByRole("button", { name: /Continue with Google/i }),
    );

    expect(await screen.findByRole("heading", { name: "Provider home" })).toBeVisible();
    expect(requestAccessToken).toHaveBeenCalledWith({ prompt: "select_account" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/web/session/google",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          accessToken: "google-provider-token",
          preferredLanguage: "en",
        }),
      }),
    );
  });

  it("verifies Apple state and sends the raw nonce into the cookie-backed session", async () => {
    let appleState = "";
    let appleHashedNonce = "";
    window.AppleID = {
      auth: {
        init: vi.fn((options) => {
          appleState = options.state;
          appleHashedNonce = options.nonce;
        }),
        signIn: vi.fn(async () => ({
          authorization: {
            id_token: "apple-identity-token",
            state: appleState,
          },
          user: {
            name: { firstName: "Marceline", lastName: "Abadeer" },
          },
        })),
      },
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input) => {
        const url = String(input);
        if (url.endsWith("/web/auth/config")) {
          return jsonResponse({
            googleClientId: null,
            apple: {
              clientId: "love.example.web",
              redirectUri: "https://app.example.com/login",
            },
          });
        }

        if (url.endsWith("/web/session/apple")) {
          return jsonResponse({
            user: {
              ...user,
              authMethods: { password: false, google: false, apple: true },
            },
            accessToken: "web-apple-access-token",
          });
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    renderLogin("Apple provider home");

    fireEvent.click(
      await screen.findByRole("button", { name: /Continue with Apple/i }),
    );

    expect(
      await screen.findByRole("heading", { name: "Apple provider home" }),
    ).toBeVisible();

    const appleRequest = fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith("/web/session/apple"),
    );
    const requestBody = JSON.parse(String(appleRequest?.[1]?.body)) as {
      identityToken: string;
      nonce: string;
      preferredLanguage: string;
      fullName: { givenName: string; familyName: string };
    };
    const expectedHashedNonce = Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(requestBody.nonce),
        ),
      ),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");

    expect(appleState).toHaveLength(48);
    expect(appleHashedNonce).toBe(expectedHashedNonce);
    expect(requestBody).toMatchObject({
      identityToken: "apple-identity-token",
      preferredLanguage: "en",
      fullName: { givenName: "Marceline", familyName: "Abadeer" },
    });
    expect(requestBody.nonce).toHaveLength(48);
    expect(requestBody.nonce).not.toBe(appleHashedNonce);
  });
});
