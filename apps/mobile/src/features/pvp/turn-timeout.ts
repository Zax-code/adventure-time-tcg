import { useEffect, useState } from "react";

type Translate = (key: string, params?: Record<string, string | number>) => string;

export function useMinuteNow(enabled = true) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, [enabled]);

  return now;
}

export function formatTurnTimeout(
  expiresAt: string | null | undefined,
  t: Translate,
  nowMs = Date.now(),
) {
  if (!expiresAt) {
    return null;
  }

  const deadlineMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(deadlineMs)) {
    return null;
  }

  const deadline = new Date(deadlineMs).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const remainingMs = deadlineMs - nowMs;
  const remaining = formatRemaining(remainingMs, t);

  return {
    deadline,
    remaining,
    fullLabel: t("pvp.timeout.full", { deadline, remaining }),
    shortLabel: t("pvp.timeout.short", { remaining }),
  };
}

function formatRemaining(remainingMs: number, t: Translate) {
  if (remainingMs <= 0) {
    return t("pvp.timeout.expired");
  }

  const totalMinutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  if (totalMinutes < 60) {
    return t("pvp.timeout.minutes", { count: totalMinutes });
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) {
    return t("pvp.timeout.hours", { count: hours });
  }

  return t("pvp.timeout.hoursMinutes", { hours, minutes });
}
