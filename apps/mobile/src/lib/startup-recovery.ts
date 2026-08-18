export const STARTUP_DEPENDENCY_TIMEOUT_MS = 5_000;
export const FONT_STARTUP_TIMEOUT_MS = 5_000;
export const SPLASH_HIDE_RETRY_DELAYS_MS = [0, 100, 500, 1_500] as const;

export type StartupTaskResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: "rejected" | "timeout" };

export async function runStartupTask<T>(
  task: () => Promise<T>,
  timeoutMs = STARTUP_DEPENDENCY_TIMEOUT_MS,
): Promise<StartupTaskResult<T>> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    const value = await Promise.race([
      task(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new StartupTimeoutError());
        }, timeoutMs);
      }),
    ]);

    return { ok: true, value };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof StartupTimeoutError ? "timeout" : "rejected",
    };
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
}

export function isFontStartupSettled({
  loaded,
  failed,
  timedOut,
}: {
  loaded: boolean;
  failed: boolean;
  timedOut: boolean;
}) {
  return loaded || failed || timedOut;
}

class StartupTimeoutError extends Error {
  constructor() {
    super("Startup dependency timed out");
    this.name = "StartupTimeoutError";
  }
}
