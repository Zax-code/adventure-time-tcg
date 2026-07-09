import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { webApiClient } from "../../lib/api";
import { AdminBalancePage, AdminCardsPage } from "./index";

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

  it("keeps the unsupported balance report honest and inert", () => {
    const cardsSpy = vi.spyOn(webApiClient, "adminCards");

    renderAdminPage(<AdminBalancePage />);

    expect(
      screen.getByRole("heading", { name: "Balance Lab is not connected." }),
    ).toBeVisible();
    expect(
      screen.getByText(/Phoenix does not expose a balance-report endpoint/i),
    ).toBeVisible();
    expect(cardsSpy).not.toHaveBeenCalled();
  });
});
