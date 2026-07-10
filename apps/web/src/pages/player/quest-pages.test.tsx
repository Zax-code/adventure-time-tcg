import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SpeedRunState } from "@adventure-time/api-client";

import { webApiClient } from "../../lib/api";
import { SpeedCalculusPage, SpeedTrainingPage } from "./quest-pages";

function renderPage(page: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{page}</MemoryRouter>
    </QueryClientProvider>,
  );
}

function speedRunState(isManuallyPaused: boolean): SpeedRunState {
  return {
    activeRun: {
      answers: [],
      correctAnswers: 0,
      durationSeconds: 60,
      isManuallyPaused,
      pauseExpiresAt: isManuallyPaused ? "2026-07-09T20:00:00Z" : null,
      pauseRemainingSeconds: isManuallyPaused ? 30 : 0,
      questionIndex: 0,
      questions: [{ index: 0, left: 1, operator: "+", right: 2 }],
      remainingSeconds: 55,
      runId: "run-1",
      runNumber: 1,
      seed: "seed-1",
      startedAt: "2026-07-09T19:59:00Z",
    },
    canCashOut: false,
    canStartRun: false,
    claimed: false,
    completed: false,
    date: "2026-07-09",
    history: [],
    latestScore: 0,
    locked: false,
    maxRuns: 3,
    rewardPerAnswer: 1,
    rewardPreview: 0,
    runDurationSeconds: 60,
    runsUsed: 1,
  };
}

describe("Speed Calculus focus management", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("does not steal focus when restoring an active scored run", async () => {
    vi.spyOn(webApiClient, "speedCalculusState").mockResolvedValue(
      speedRunState(false),
    );

    renderPage(<SpeedCalculusPage />);

    expect(await screen.findByRole("textbox", { name: "Answer" })).not.toHaveFocus();
  });

  it("focuses the scored answer after the player resumes explicitly", async () => {
    const resumedState = speedRunState(false);
    vi.spyOn(webApiClient, "speedCalculusState")
      .mockResolvedValueOnce(speedRunState(true))
      .mockResolvedValue(resumedState);
    vi.spyOn(webApiClient, "resumeSpeedCalculus").mockResolvedValue(resumedState);

    renderPage(<SpeedCalculusPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Resume run" }));

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "Answer" })).toHaveFocus();
    });
  });

  it("focuses training only after the player starts and advances it", async () => {
    vi.spyOn(webApiClient, "startSpeedCalculusTraining").mockResolvedValue({
      pauseDurationSeconds: 30,
      questions: [
        { index: 0, left: 1, operator: "+", right: 2 },
        { index: 1, left: 5, operator: "-", right: 3 },
      ],
      rewardPerAnswer: 1,
      runDurationSeconds: 60,
      runId: "training-1",
      seed: "training-seed",
    });

    renderPage(<SpeedTrainingPage />);

    fireEvent.click(screen.getByRole("button", { name: "Begin training" }));

    const answer = await screen.findByRole("textbox", { name: "Answer" });
    await waitFor(() => expect(answer).toHaveFocus());

    fireEvent.change(answer, { target: { value: "3" } });
    const submit = screen.getByRole("button", { name: "Check" });
    submit.focus();
    fireEvent.click(submit);

    await waitFor(() => {
      expect(screen.getByText("Question 2")).toBeVisible();
      expect(screen.getByRole("textbox", { name: "Answer" })).toHaveFocus();
    });
  });

  it("finishes a scored run when its final question is answered", async () => {
    const completedQuestionState = speedRunState(false);
    completedQuestionState.activeRun!.questionIndex = 1;
    const finishedState = { ...completedQuestionState, activeRun: null };
    vi.spyOn(webApiClient, "speedCalculusState").mockResolvedValue(completedQuestionState);
    const finish = vi.spyOn(webApiClient, "finishSpeedCalculus").mockResolvedValue({
      ...finishedState,
      correctAnswers: 1,
      reward: 1,
    });

    renderPage(<SpeedCalculusPage />);

    await waitFor(() => {
      expect(finish).toHaveBeenCalledWith("run-1", undefined);
    });
  });
});
