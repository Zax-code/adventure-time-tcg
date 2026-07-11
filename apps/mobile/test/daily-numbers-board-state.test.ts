import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DailyNumbersStep } from "@adventure-time/api-client";

import {
  createDailyNumbersBoardInteractionState,
  dailyNumbersBoardReducer,
  getDailyNumbersAttemptTiming,
} from "../src/features/quests/daily-numbers/board-state.ts";

const step: DailyNumbersStep = {
  leftId: "n0",
  leftValue: 25,
  operator: "+",
  rightId: "n1",
  rightValue: 4,
  resultId: "r0",
  resultValue: 29,
};

describe("Daily Numbers board state", () => {
  it("preserves the select, apply, undo, and reset sequence", () => {
    let state = createDailyNumbersBoardInteractionState({ submission: null });

    state = dailyNumbersBoardReducer(state, {
      type: "selectTile",
      tileId: "n0",
    });
    state = dailyNumbersBoardReducer(state, {
      type: "toggleOperator",
      operator: "+",
    });
    state = dailyNumbersBoardReducer(state, {
      type: "selectTile",
      tileId: "n1",
    });

    assert.equal(state.selectedLeftId, "n0");
    assert.equal(state.selectedOperator, "+");
    assert.equal(state.selectedRightId, "n1");

    state = dailyNumbersBoardReducer(state, {
      type: "applyStep",
      step,
      autoSubmitting: false,
    });

    assert.deepEqual(state.steps, [step]);
    assert.equal(state.selectedLeftId, null);
    assert.equal(state.selectedOperator, null);
    assert.equal(state.selectedRightId, null);

    state = dailyNumbersBoardReducer(state, { type: "undoStep" });
    assert.deepEqual(state.steps, []);

    state = dailyNumbersBoardReducer(state, {
      type: "applyStep",
      step,
      autoSubmitting: false,
    });
    state = dailyNumbersBoardReducer(state, { type: "toggleSolution" });
    state = dailyNumbersBoardReducer(state, { type: "resetBoard" });

    assert.deepEqual(state.steps, []);
    assert.equal(state.revealedSolution, true);
    assert.deepEqual(getDailyNumbersAttemptTiming(state), {
      attemptScope: "initial",
      resetSignal: 0,
    });
  });

  it("starts a fresh retry timing scope without making Reset restart it", () => {
    let state = createDailyNumbersBoardInteractionState({ submission: null });
    state = dailyNumbersBoardReducer(state, { type: "toggleSolution" });
    state = dailyNumbersBoardReducer(state, {
      type: "applyStep",
      step,
      autoSubmitting: false,
    });
    state = dailyNumbersBoardReducer(state, { type: "startRetry" });

    assert.equal(state.retrying, true);
    assert.equal(state.retryAttempt, 1);
    assert.equal(state.revealedSolution, false);
    assert.deepEqual(state.steps, []);
    assert.deepEqual(getDailyNumbersAttemptTiming(state), {
      attemptScope: "retry",
      resetSignal: 1,
    });

    state = dailyNumbersBoardReducer(state, {
      type: "applyStep",
      step,
      autoSubmitting: false,
    });
    state = dailyNumbersBoardReducer(state, { type: "resetBoard" });

    assert.deepEqual(getDailyNumbersAttemptTiming(state), {
      attemptScope: "retry",
      resetSignal: 1,
    });
  });

  it("hydrates locked solution steps without mutating them", () => {
    const submittedSteps = [step];
    const state = createDailyNumbersBoardInteractionState({
      submission: { steps: submittedSteps },
    });
    const undoneState = dailyNumbersBoardReducer(state, { type: "undoStep" });

    assert.deepEqual(state.steps, [step]);
    assert.equal(state.steps, submittedSteps);
    assert.deepEqual(undoneState.steps, []);
    assert.deepEqual(submittedSteps, [step]);
  });
});
