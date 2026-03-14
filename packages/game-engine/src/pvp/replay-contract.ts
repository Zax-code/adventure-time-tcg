import type { CombatEvent } from "../combat/types";

export const REPLAY_VERSION_CURRENT = 2;

export interface ReplayContractInput {
  replayVersion: number | null | undefined;
  state: string | null | undefined;
  initialState: string | null | undefined;
  log: string | null | undefined;
}

export interface ReplayContractCheck {
  ok: boolean;
  reason?: string;
  log?: CombatEvent[];
}

export function validateReplayContract(input: ReplayContractInput): ReplayContractCheck {
  if (input.replayVersion !== REPLAY_VERSION_CURRENT) {
    return { ok: false, reason: "version_mismatch" };
  }

  if (!input.state || !input.initialState || !input.log) {
    return { ok: false, reason: "missing_payload" };
  }

  let parsedLog: unknown;
  try {
    parsedLog = JSON.parse(input.log);
  } catch {
    return { ok: false, reason: "invalid_log_json" };
  }

  if (!Array.isArray(parsedLog)) {
    return { ok: false, reason: "log_not_array" };
  }

  const isValidLog = parsedLog.every((event) => {
    if (!event || typeof event !== "object") return false;
    const seq = (event as { seq?: unknown }).seq;
    return typeof seq === "number" && Number.isFinite(seq);
  });

  if (!isValidLog) {
    return { ok: false, reason: "invalid_log_shape" };
  }

  return { ok: true, log: parsedLog as CombatEvent[] };
}
