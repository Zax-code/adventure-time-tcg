export const RESET_TIMEZONE = "Europe/Paris";
export const DAILY_REWARD = 100;

export function getResetDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: RESET_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function canClaimDaily(lastClaim: Date | null) {
  if (!lastClaim) {
    return true;
  }

  return getResetDateKey(new Date()) !== getResetDateKey(lastClaim);
}

function getMidnightParis(date: Date) {
  const parisDateStr = getResetDateKey(date);
  const midnightParis = new Date(`${parisDateStr}T00:00:00`);
  const parisTime = new Date(date.toLocaleString("en-US", { timeZone: RESET_TIMEZONE }));
  const utcTime = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  const offsetMs = utcTime.getTime() - parisTime.getTime();

  return new Date(midnightParis.getTime() + offsetMs);
}

export function getTimeUntilNextClaim() {
  const now = new Date();
  const parisDateStr = getResetDateKey(now);
  const [year, month, day] = parisDateStr.split("-").map(Number);
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  const nextMidnightParis = getMidnightParis(nextDay);

  return Math.max(0, nextMidnightParis.getTime() - now.getTime());
}
