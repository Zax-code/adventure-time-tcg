import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AdminFlaggedLeaderboardResult } from "@adventure-time/api-client";

import { webApiClient } from "../../lib/api";
import { AdminLeaderboardIntegrityPage } from "./index";

const RESULT_ID = "11111111-1111-4111-8111-111111111111";
const SNAPSHOT_ID = "22222222-2222-4222-8222-222222222222";

function flagged(
  overrides: Partial<AdminFlaggedLeaderboardResult> = {},
): AdminFlaggedLeaderboardResult {
  return {
    id: RESULT_ID,
    boardKey: "daily-numbers/1-5",
    competitionDate: "2026-10-07",
    userId: "33333333-3333-4333-8333-333333333333",
    displayName: "Marceline",
    resultStatus: "accepted",
    integrityStatus: "accepted",
    integrityReasonCodes: ["server_observed_elapsed", "suspicious_elapsed_ratio"],
    serverElapsedMs: 600_000,
    clientElapsedMs: 20_000,
    pointsMilli: 4_200,
    rawResult: { kind: "exact_completion_time", elapsedMs: 20_000, exact: true },
    submittedAt: "2026-10-07T10:00:00Z",
    snapshotId: null,
    ...overrides,
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdminLeaderboardIntegrityPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminLeaderboardIntegrityPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows the timing evidence and excludes a live result with a reason", async () => {
    vi.spyOn(webApiClient, "adminFlaggedLeaderboardResults").mockResolvedValue({
      reason: "suspicious_elapsed_ratio",
      reasons: ["suspicious_elapsed_ratio"],
      results: [flagged()],
    });
    const exclude = vi
      .spyOn(webApiClient, "excludeLeaderboardResult")
      .mockResolvedValue({ id: RESULT_ID, status: "excluded" });

    renderPage();

    expect(await screen.findByRole("heading", { name: "Marceline", level: 2 })).toBeVisible();
    expect(screen.getByText("10 min 0 s")).toBeVisible();
    expect(screen.getAllByText("20 s").length).toBeGreaterThan(0);

    const button = screen.getByRole("button", { name: "Exclude result" });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Timer far below the server window" },
    });
    fireEvent.click(button);

    await waitFor(() =>
      expect(exclude).toHaveBeenCalledWith(RESULT_ID, {
        reason: "Timer far below the server window",
      }),
    );
  });

  it("previews then confirms a correction for a published result", async () => {
    vi.spyOn(webApiClient, "adminFlaggedLeaderboardResults").mockResolvedValue({
      reason: "suspicious_elapsed_ratio",
      reasons: ["suspicious_elapsed_ratio"],
      results: [flagged({ resultStatus: "snapshotted", snapshotId: SNAPSHOT_ID })],
    });
    const correction = {
      id: "44444444-4444-4444-8444-444444444444",
      sourceSnapshotId: SNAPSHOT_ID,
      sourceRevision: 1,
      status: "previewed" as const,
      previewHash: "hash-1",
      proposedChanges: { excludeDailyResultIds: [RESULT_ID] },
      rankDelta: { a: { before: 1, after: null } },
      rewardDelta: {},
      resultingSnapshotId: null,
    };
    const preview = vi
      .spyOn(webApiClient, "previewLeaderboardCorrection")
      .mockResolvedValue(correction);
    const confirm = vi
      .spyOn(webApiClient, "confirmLeaderboardCorrection")
      .mockResolvedValue({ ...correction, status: "applied" });

    renderPage();

    fireEvent.change(await screen.findByRole("textbox"), {
      target: { value: "Timer far below the server window" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Preview correction" }));

    await waitFor(() =>
      expect(preview).toHaveBeenCalledWith(SNAPSHOT_ID, {
        reason: "Timer far below the server window",
        excludeUserIds: [],
        excludeDailyResultIds: [RESULT_ID],
      }),
    );

    fireEvent.click(await screen.findByRole("button", { name: "Confirm correction" }));

    await waitFor(() =>
      expect(confirm).toHaveBeenCalledWith(SNAPSHOT_ID, {
        previewHash: "hash-1",
        confirm: true,
      }),
    );
  });
});
