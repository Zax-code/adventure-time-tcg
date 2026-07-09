import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AuthUser } from "@adventure-time/api-client";

import { AuthProvider } from "../../auth/auth-provider";
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

describe("LoginPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a browser session and continues to the signed-in home", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input) => {
        const url = String(input);
        if (url.endsWith("/web/session/refresh")) {
          return jsonResponse({ error: "No session" }, 401);
        }

        if (url.endsWith("/web/session")) {
          return jsonResponse({ user, accessToken: "access-token" });
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/home" element={<h1>Signed-in home</h1>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

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
});
