import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  DailyNumbersSolutionHuntSubmitResponse,
  DailyNumbersStateResponse,
  SpeedRunState,
} from "@adventure-time/api-client";

import { webApiClient } from "../../lib/api";
import {
  DailyNumbersPlayPage,
  SpeedCalculusPage,
  SpeedTrainingPage,
} from "./quest-pages";

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

function dailyNumbersState(
  found = 1,
  total = 3,
): DailyNumbersStateResponse {
  const rankedStep = {
    leftId: "n0",
    leftValue: 100,
    operator: "+" as const,
    rightId: "n1",
    rightValue: 5,
    resultId: "ranked-result",
    resultValue: 105,
  };
  const otherStep = {
    leftId: "n0",
    leftValue: 100,
    operator: "+" as const,
    rightId: "n5",
    rightValue: 6,
    resultId: "other-result",
    resultValue: 106,
  };

  return {
    mode: "1-5",
    date: "2026-08-18",
    resetTimezone: "America/New_York",
    target: 105,
    numbers: [100, 5, 2, 3, 4, 6].map((value, index) => ({
      id: `n${index}`,
      source: "initial" as const,
      status: "available" as const,
      value,
    })),
    generationAttempt: 1,
    bestValue: 105,
    bestDistance: 0,
    questVersion: "quest-1",
    resetByName: null,
    reward: 10,
    claimed: true,
    completed: true,
    submitted: true,
    submission: {
      finalValue: 105,
      defaultDistance: 0,
      distance: 0,
      exact: true,
      score: 100,
      completed: true,
      elapsedMs: 12_000,
      steps: [rankedStep],
      officialSolutionUnlocked: true,
      officialSolutionSteps: [rankedStep],
    },
    solutionHunt: {
      available: true,
      solutionsFound: found,
      totalSolutions: total,
      allSolutionsFound: found === total,
      yourSolutions: found ? [{ number: 1, steps: [rankedStep] }] : [],
      otherSolutions: Array.from({ length: total - found }, (_, index) => ({
        number: index + 1,
        steps: [{ ...otherStep, resultId: `other-result-${index}` }],
      })),
    },
  };
}

describe("Daily Numbers Solution Hunt", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows discovered solutions directly and keeps remaining solutions behind a reveal", async () => {
    vi.spyOn(webApiClient, "startDailyNumbersRanked").mockResolvedValue(
      dailyNumbersState(),
    );

    renderPage(<DailyNumbersPlayPage />);

    expect(await screen.findByText("Your solutions")).toBeVisible();
    const yourSolution = screen
      .getByTestId("daily-numbers-your-solutions")
      .querySelector("details");
    expect(yourSolution).not.toHaveAttribute("open");
    expect(screen.getByText("Other solutions").closest("details")).not.toHaveAttribute(
      "open",
    );
  });

  it("uses Existing solutions before the player discovers an exact route", async () => {
    vi.spyOn(webApiClient, "startDailyNumbersRanked").mockResolvedValue(
      dailyNumbersState(0, 3),
    );

    renderPage(<DailyNumbersPlayPage />);

    expect(await screen.findByText("Existing solutions")).toBeVisible();
    expect(screen.queryByText("Your solutions")).not.toBeInTheDocument();
  });

  it("updates the numbered lists after a new hunt submission", async () => {
    const initial = dailyNumbersState();
    const result: DailyNumbersSolutionHuntSubmitResponse = {
      valid: true,
      newSolution: true,
      alreadyFound: false,
      solutionsFound: 2,
      totalSolutions: 3,
      allSolutionsFound: false,
      yourSolutions: [
        ...initial.solutionHunt!.yourSolutions,
        {
          number: 2,
          steps: initial.submission!.steps,
        },
      ],
      otherSolutions: [initial.solutionHunt!.otherSolutions[0]],
    };

    vi.spyOn(webApiClient, "startDailyNumbersRanked").mockResolvedValue(initial);
    const submit = vi
      .spyOn(webApiClient, "submitDailyNumbersSolutionHunt")
      .mockResolvedValue(result);

    renderPage(<DailyNumbersPlayPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Find another solution" }));
    fireEvent.click(screen.getByRole("button", { name: "100" }));
    fireEvent.click(screen.getByRole("button", { name: "5" }));
    fireEvent.click(screen.getByRole("button", { name: "Combine tiles" }));
    fireEvent.click(screen.getByRole("button", { name: "Check exact solution" }));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("2 / 3 solutions found")).toBeVisible();
    expect(screen.getByText("New solution!")).toBeVisible();
    expect(screen.getByText("Solution 2")).toBeVisible();
  });
});

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
