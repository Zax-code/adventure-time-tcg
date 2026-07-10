import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/theme/theme-provider";

const authState = vi.hoisted(() => ({ isSuperAdmin: false }));

vi.mock("@/auth/auth-provider", () => ({
  useAuth: () => ({
    logout: vi.fn(),
    status: "authenticated",
    user: {
      avatarAssetId: null,
      coins: 100,
      displayName: "Operations Tester",
      dust: 20,
      email: "admin@example.com",
      isAdmin: true,
      isSuperAdmin: authState.isSuperAdmin,
    },
  }),
}));

import { AppLayout, SuperAdminRoute } from "./layout";

describe("SuperAdminRoute", () => {
  beforeEach(() => {
    authState.isSuperAdmin = false;
  });

  function renderRoute() {
    return render(
      <MemoryRouter initialEntries={["/admin/email-requests"]}>
        <Routes>
          <Route element={<SuperAdminRoute />}>
            <Route
              path="/admin/email-requests"
              element={<h1>Access requests</h1>}
            />
          </Route>
          <Route path="/admin" element={<h1>Admin overview</h1>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  function renderAdminShell() {
    return render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/admin"]}>
          <Routes>
            <Route element={<AppLayout admin />}>
              <Route path="/admin" element={<h1>Admin content</h1>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );
  }

  it("redirects regular administrators away from access requests", () => {
    renderRoute();

    expect(screen.getByRole("heading", { name: "Admin overview" })).toBeVisible();
    expect(screen.queryByText("Access requests")).not.toBeInTheDocument();
  });

  it("allows super administrators to open access requests", () => {
    authState.isSuperAdmin = true;
    renderRoute();

    expect(screen.getByRole("heading", { name: "Access requests" })).toBeVisible();
  });

  it("does not show Requests in a regular administrator's navigation", () => {
    renderAdminShell();

    expect(screen.queryByRole("link", { name: "Requests" })).not.toBeInTheDocument();
  });

  it("shows Requests in a super administrator's navigation", () => {
    authState.isSuperAdmin = true;
    renderAdminShell();

    expect(screen.getByRole("link", { name: "Requests" })).toBeVisible();
  });
});
