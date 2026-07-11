import type { DailyNumbersStep } from "@adventure-time/api-client";

import type { DailyNumbersOperator } from "./board-interaction";

export type DailyNumbersMessageState = {
  type: "success" | "error";
  text: string;
} | null;

export type DailyNumbersSlotKey = "left" | "operator" | "right";

export type DailyNumbersBoardInteractionState = {
  steps: DailyNumbersStep[];
  selectedLeftId: string | null;
  selectedOperator: DailyNumbersOperator | null;
  selectedRightId: string | null;
  message: DailyNumbersMessageState;
  submitting: boolean;
  revealedSolution: boolean;
  retrying: boolean;
  retryAttempt: number;
};

export type DailyNumbersBoardAction =
  | { type: "selectTile"; tileId: string }
  | { type: "toggleOperator"; operator: DailyNumbersOperator }
  | { type: "clearSlot"; slot: DailyNumbersSlotKey }
  | { type: "applyStep"; step: DailyNumbersStep; autoSubmitting: boolean }
  | { type: "undoStep" }
  | { type: "resetBoard" }
  | { type: "setMessage"; message: DailyNumbersMessageState }
  | { type: "submitStarted" }
  | { type: "submitFailed"; message: DailyNumbersMessageState }
  | { type: "submitFinished" }
  | { type: "startRetry" }
  | { type: "toggleSolution" };

type InitialBoardState = {
  submission?: { steps: DailyNumbersStep[] } | null;
};

export function createDailyNumbersBoardInteractionState(
  state: InitialBoardState,
): DailyNumbersBoardInteractionState {
  return {
    steps: state.submission?.steps ?? [],
    selectedLeftId: null,
    selectedOperator: null,
    selectedRightId: null,
    message: null,
    submitting: false,
    revealedSolution: false,
    retrying: false,
    retryAttempt: 0,
  };
}

export function getDailyNumbersAttemptTiming(
  state: DailyNumbersBoardInteractionState,
) {
  return {
    attemptScope: state.retrying ? "retry" : "initial",
    resetSignal: state.retrying ? state.retryAttempt : 0,
  };
}

export function dailyNumbersBoardReducer(
  state: DailyNumbersBoardInteractionState,
  action: DailyNumbersBoardAction,
): DailyNumbersBoardInteractionState {
  if (action.type === "selectTile") {
    if (action.tileId === state.selectedLeftId) {
      return {
        ...state,
        selectedLeftId: null,
        message: null,
      };
    }

    if (action.tileId === state.selectedRightId) {
      return {
        ...state,
        selectedRightId: null,
        message: null,
      };
    }

    if (!state.selectedLeftId) {
      return {
        ...state,
        selectedLeftId: action.tileId,
        message: null,
      };
    }

    if (!state.selectedRightId) {
      return {
        ...state,
        selectedRightId: action.tileId,
        message: null,
      };
    }

    return state;
  }

  if (action.type === "toggleOperator") {
    return {
      ...state,
      selectedOperator:
        state.selectedOperator === action.operator ? null : action.operator,
      message: null,
    };
  }

  if (action.type === "clearSlot") {
    if (action.slot === "left") {
      return {
        ...state,
        selectedLeftId: null,
        message: null,
      };
    }

    if (action.slot === "operator") {
      return {
        ...state,
        selectedOperator: null,
        message: null,
      };
    }

    return {
      ...state,
      selectedRightId: null,
      message: null,
    };
  }

  if (action.type === "applyStep") {
    return {
      ...state,
      steps: [...state.steps, action.step],
      selectedLeftId: null,
      selectedOperator: null,
      selectedRightId: null,
      message: null,
      submitting: action.autoSubmitting,
    };
  }

  if (action.type === "undoStep") {
    return {
      ...state,
      steps: state.steps.slice(0, -1),
      selectedLeftId: null,
      selectedOperator: null,
      selectedRightId: null,
      message: null,
    };
  }

  if (action.type === "resetBoard") {
    return {
      ...state,
      steps: [],
      selectedLeftId: null,
      selectedOperator: null,
      selectedRightId: null,
      message: null,
    };
  }

  if (action.type === "setMessage") {
    return {
      ...state,
      message: action.message,
    };
  }

  if (action.type === "submitStarted") {
    return {
      ...state,
      submitting: true,
      message: null,
    };
  }

  if (action.type === "submitFailed") {
    return {
      ...state,
      submitting: false,
      message: action.message,
    };
  }

  if (action.type === "submitFinished") {
    return {
      ...state,
      submitting: false,
      retrying: false,
    };
  }

  if (action.type === "startRetry") {
    return {
      steps: [],
      selectedLeftId: null,
      selectedOperator: null,
      selectedRightId: null,
      message: null,
      submitting: false,
      revealedSolution: false,
      retrying: true,
      retryAttempt: state.retryAttempt + 1,
    };
  }

  return {
    ...state,
    revealedSolution: !state.revealedSolution,
  };
}
