import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { webApiClient } from "../../lib/api";
import { AdminBalancePage, AdminCardsPage } from "./index";
import { BALANCE_HISTORY_STORAGE_KEY } from "./balance-report";

function renderAdminPage(page: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{page}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("admin web pages", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders the real card catalog and its supported controls", async () => {
    vi.spyOn(webApiClient, "adminCards").mockResolvedValue({
      cards: [
        {
          id: "finn",
          name: "Finn the Human",
          character: "Finn",
          rarityName: "Legendary",
          rarityId: "legendary",
          isArchived: false,
          isFeatured: true,
          description: "A brave hero.",
          hp: 120,
          attack: 35,
          defense: 24,
          speed: 30,
          type: "Hero",
          imageAssetId: null,
        },
      ],
    });

    renderAdminPage(<AdminCardsPage />);

    expect(
      await screen.findByRole("heading", { name: "Shape the card catalog." }),
    ).toBeVisible();
    expect(await screen.findByText("Finn the Human")).toBeVisible();
    expect(screen.getAllByText("Featured").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Create card" })).toHaveAttribute(
      "href",
      "/admin/cards/new",
    );
    expect(
      screen.getByRole("link", { name: /Edit Finn the Human/ }),
    ).toHaveAttribute("href", "/admin/cards/finn");
  });

  it("generates and stores a real catalog balance report", async () => {
    const cardsSpy = vi.spyOn(webApiClient, "adminCards").mockResolvedValue({
      cards: [
        {
          id: "finn",
          name: "Finn the Human",
          character: "Finn",
          rarityName: "Legendary",
          rarityId: "legendary",
          isArchived: false,
          isFeatured: true,
          description: "A brave hero.",
          hp: 120,
          attack: 35,
          defense: 24,
          speed: 30,
          type: "Hero",
          imageAssetId: null,
        },
        {
          id: "jake",
          name: "Jake the Dog",
          character: "Jake",
          rarityName: "Legendary",
          rarityId: "legendary",
          isArchived: false,
          isFeatured: true,
          description: "A stretchy hero.",
          hp: 135,
          attack: 28,
          defense: 30,
          speed: 24,
          type: "Hero",
          imageAssetId: null,
        },
      ],
    });

    renderAdminPage(<AdminBalancePage />);

    expect(
      screen.getByRole("heading", { name: "Read the shape of the roster." }),
    ).toBeVisible();
    expect(await screen.findByText("2 cards will be analyzed")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Generate analysis" }));

    expect(
      await screen.findByRole("heading", { name: "Generated report" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Card score ledger" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Download JSON" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Download CSV" })).toBeEnabled();
    expect(screen.getByText(/does not use match telemetry/i)).toBeVisible();
    expect(cardsSpy).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      const saved = window.localStorage.getItem(BALANCE_HISTORY_STORAGE_KEY);
      expect(saved).toContain("Phoenix admin card catalog");
    });
  });
});
