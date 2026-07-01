import type { DailyNumbersStep } from "@adventure-time/api-client";

export type DailyNumbersOperator = DailyNumbersStep["operator"];

export type DailyNumbersSelectableTile = {
  id: string;
  value: number;
};

type OperationResult =
  { ok: true; result: number } | { ok: false; reason: "division" | "positive" };

export type DailyNumbersAvailability = {
  selected: boolean;
  wouldBeInvalid: boolean;
  disabled: boolean;
};

export function applyDailyNumbersOperation(
  leftValue: number,
  operator: DailyNumbersOperator,
  rightValue: number,
): OperationResult {
  if (operator === "+") {
    return { ok: true, result: leftValue + rightValue };
  }

  if (operator === "*") {
    return { ok: true, result: leftValue * rightValue };
  }

  if (operator === "-") {
    const result = leftValue - rightValue;
    return result > 0
      ? { ok: true, result }
      : { ok: false, reason: "positive" };
  }

  if (rightValue === 0 || leftValue % rightValue !== 0) {
    return { ok: false, reason: "division" };
  }

  const result = leftValue / rightValue;
  return result > 0 ? { ok: true, result } : { ok: false, reason: "positive" };
}

export function getDailyNumbersOperatorPressResult({
  interactionLocked,
  operator,
  selectedOperator,
}: {
  interactionLocked: boolean;
  operator: DailyNumbersOperator;
  selectedOperator: DailyNumbersOperator | null;
}):
  | { accepted: true; nextSelectedOperator: DailyNumbersOperator | null }
  | { accepted: false; reason: "locked" } {
  if (interactionLocked) {
    return { accepted: false, reason: "locked" };
  }

  return {
    accepted: true,
    nextSelectedOperator: selectedOperator === operator ? null : operator,
  };
}

export function getDailyNumbersOperatorAvailability({
  interactionLocked,
  operator,
  selectedLeftTile,
  selectedOperator,
  selectedRightTile,
}: {
  interactionLocked: boolean;
  operator: DailyNumbersOperator;
  selectedLeftTile: DailyNumbersSelectableTile | null;
  selectedOperator: DailyNumbersOperator | null;
  selectedRightTile: DailyNumbersSelectableTile | null;
}): DailyNumbersAvailability {
  const selected = selectedOperator === operator;
  const wouldBeInvalid =
    selectedLeftTile && selectedRightTile
      ? !applyDailyNumbersOperation(
          selectedLeftTile.value,
          operator,
          selectedRightTile.value,
        ).ok
      : false;

  return {
    selected,
    wouldBeInvalid,
    disabled: interactionLocked || (wouldBeInvalid && !selected),
  };
}

export function getDailyNumbersTileAvailability({
  interactionLocked,
  selectedLeftTile,
  selectedOperator,
  selectedRightTile,
  tile,
}: {
  interactionLocked: boolean;
  selectedLeftTile: DailyNumbersSelectableTile | null;
  selectedOperator: DailyNumbersOperator | null;
  selectedRightTile: DailyNumbersSelectableTile | null;
  tile: DailyNumbersSelectableTile;
}): DailyNumbersAvailability {
  const selected =
    tile.id === selectedLeftTile?.id || tile.id === selectedRightTile?.id;
  const selectionFull = selectedLeftTile !== null && selectedRightTile !== null;
  let wouldBeInvalid = false;

  if (!selected && selectedOperator) {
    if (selectedLeftTile && !selectedRightTile) {
      wouldBeInvalid = !applyDailyNumbersOperation(
        selectedLeftTile.value,
        selectedOperator,
        tile.value,
      ).ok;
    } else if (!selectedLeftTile && selectedRightTile) {
      wouldBeInvalid = !applyDailyNumbersOperation(
        tile.value,
        selectedOperator,
        selectedRightTile.value,
      ).ok;
    }
  }

  return {
    selected,
    wouldBeInvalid,
    disabled:
      interactionLocked || (!selected && (selectionFull || wouldBeInvalid)),
  };
}
