import * as SecureStore from "expo-secure-store";

import {
  perfectTimingStopSchema,
  type PerfectTimingStopInput,
} from "@adventure-time/api-client";

const KEY_PREFIX = "perfectTimingPendingStop";

function keyForUser(userId: string) {
  return `${KEY_PREFIX}.${userId.replace(/[^A-Za-z0-9._-]/g, "_")}`;
}

export async function loadPendingPerfectTimingStop(userId: string) {
  const stored = await SecureStore.getItemAsync(keyForUser(userId));
  if (!stored) return null;

  try {
    const parsed = perfectTimingStopSchema.safeParse(JSON.parse(stored));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function savePendingPerfectTimingStop(
  userId: string,
  input: PerfectTimingStopInput,
) {
  const validated = perfectTimingStopSchema.parse(input);
  SecureStore.setItem(keyForUser(userId), JSON.stringify(validated));
}

export async function clearPendingPerfectTimingStop(
  userId: string,
  attemptId: string,
) {
  const current = await loadPendingPerfectTimingStop(userId);
  if (!current || current.attemptId === attemptId) {
    await SecureStore.deleteItemAsync(keyForUser(userId));
  }
}
