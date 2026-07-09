import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StatusPage } from "./status-page";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("StatusPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("reports the live health and readiness probes in player language", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/health")) {
        return jsonResponse({ status: "ok", service: "phoenix" });
      }
      if (url.endsWith("/ready")) {
        return jsonResponse({ status: "ready", service: "phoenix" });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const testQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={testQueryClient}>
        <StatusPage />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "All systems operational" }),
    ).toBeVisible();
    expect(screen.getByText("Players can reach the game")).toBeVisible();
    expect(screen.getByText("Sign-in, packs, quests, and battles")).toBeVisible();
    expect(screen.getByText("Collections and match history")).toBeVisible();
    expect(screen.getAllByText("Operational")).toHaveLength(3);
  });

  it("distinguishes a readiness problem from a complete outage", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      return url.endsWith("/health")
        ? jsonResponse({ status: "ok", service: "phoenix" })
        : jsonResponse({ status: "not_ready", service: "phoenix" }, 503);
    });
    const testQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={testQueryClient}>
        <StatusPage />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Some services are recovering" }),
    ).toBeVisible();
    expect(screen.getByText("Degraded")).toBeVisible();
    expect(screen.getAllByText("Operational")).toHaveLength(2);
  });
});
