export type QuestDayCutoffEvent = {
  previousDayKey: string;
  currentDayKey: string;
};

export type QuestRouteContext = {
  pathname: string;
  archiveDate?: string | null;
};

type TimerHandle = ReturnType<typeof setTimeout>;
type DatePart = "day" | "month" | "year";

type QuestDayCutoffControllerOptions = {
  timeZone: string;
  getNow?: () => number;
  getRouteContext: () => QuestRouteContext;
  onDayChanged: (event: QuestDayCutoffEvent) => void;
  onQuestCutoff: (
    event: QuestDayCutoffEvent,
    routeContext: QuestRouteContext,
  ) => void;
  onError?: (error: unknown) => void;
  schedule?: (callback: () => void, delayMs: number) => TimerHandle;
  cancel?: (handle: TimerHandle) => void;
};

const QUEST_HUB_PATHNAMES = new Set(["/quests", "/(tabs)/quests"]);
const DAILY_QUEST_PATHNAMES = new Set([
  "/quests/wordle",
  "/quests/speed-calculus",
  "/quests/perfect-timing",
  "/quests/daily-numbers",
  "/quests/daily-numbers-play",
]);
export const DEFAULT_QUEST_TIME_ZONE = "Europe/Paris";
const MAX_BOUNDARY_SEARCH_MS = 36 * 60 * 60 * 1_000;
const dayFormatters = new Map<string, Intl.DateTimeFormat>();

function getDayFormatter(timeZone: string) {
  const cached = dayFormatters.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-US", {
    calendar: "iso8601",
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  });
  dayFormatters.set(timeZone, formatter);
  return formatter;
}

function resolveQuestTimeZone(timeZone: string) {
  const candidates = [timeZone.trim(), DEFAULT_QUEST_TIME_ZONE, "UTC"];
  for (const candidate of candidates) {
    if (!candidate) continue;

    try {
      getDayFormatter(candidate);
      return candidate;
    } catch {
      // Some devices ship a smaller ICU timezone database. Keep the cutoff alive
      // with the backend default instead of crashing the root layout.
    }
  }

  return "UTC";
}

function getQuestDayKeyInTimeZone(timestampMs: number, timeZone: string) {
  if (!Number.isFinite(timestampMs)) {
    throw new RangeError("Quest cutoff timestamp must be finite.");
  }

  const values = new Map<DatePart, string>();
  for (const part of getDayFormatter(timeZone).formatToParts(
    new Date(timestampMs),
  )) {
    if (part.type === "day" || part.type === "month" || part.type === "year") {
      values.set(part.type, part.value);
    }
  }

  const year = values.get("year");
  const month = values.get("month");
  const day = values.get("day");
  if (!year || !month || !day) {
    throw new RangeError(`Could not resolve the quest day in ${timeZone}.`);
  }

  return `${year}-${month}-${day}`;
}

export function getQuestDayKey(timestampMs: number, timeZone: string) {
  return getQuestDayKeyInTimeZone(
    timestampMs,
    resolveQuestTimeZone(timeZone),
  );
}

export function isCurrentQuestDay(
  dateKey: string,
  timeZone: string,
  timestampMs = Date.now(),
) {
  return dateKey === getQuestDayKey(timestampMs, timeZone);
}

export function isQuestHubPath(routeContext: QuestRouteContext) {
  return QUEST_HUB_PATHNAMES.has(routeContext.pathname);
}

export function isQuestExperiencePath(routeContext: QuestRouteContext) {
  if (isQuestHubPath(routeContext)) return true;
  if (!DAILY_QUEST_PATHNAMES.has(routeContext.pathname)) return false;

  return !(
    routeContext.pathname === "/quests/daily-numbers-play" &&
    routeContext.archiveDate &&
    /^\d{4}-\d{2}-\d{2}$/.test(routeContext.archiveDate)
  );
}

export function getNextQuestDayBoundaryMs(
  timestampMs: number,
  timeZone: string,
) {
  const resolvedTimeZone = resolveQuestTimeZone(timeZone);
  const currentDayKey = getQuestDayKeyInTimeZone(
    timestampMs,
    resolvedTimeZone,
  );
  let low = Math.floor(timestampMs) + 1;
  let high = low + MAX_BOUNDARY_SEARCH_MS;

  if (getQuestDayKeyInTimeZone(high, resolvedTimeZone) === currentDayKey) {
    throw new RangeError(
      `Could not find the next quest day in ${resolvedTimeZone}.`,
    );
  }

  while (low < high) {
    const midpoint = low + Math.floor((high - low) / 2);
    if (
      getQuestDayKeyInTimeZone(midpoint, resolvedTimeZone) === currentDayKey
    ) {
      low = midpoint + 1;
    } else {
      high = midpoint;
    }
  }

  return low;
}

export class QuestDayCutoffController {
  private readonly timeZone: string;
  private readonly getNow: () => number;
  private readonly getRouteContext: () => QuestRouteContext;
  private readonly onDayChanged: (event: QuestDayCutoffEvent) => void;
  private readonly onQuestCutoff: (
    event: QuestDayCutoffEvent,
    routeContext: QuestRouteContext,
  ) => void;
  private readonly onError: (error: unknown) => void;
  private readonly schedule: (
    callback: () => void,
    delayMs: number,
  ) => TimerHandle;
  private readonly cancel: (handle: TimerHandle) => void;
  private timer: TimerHandle | null = null;
  private currentDayKey: string | null = null;
  private started = false;

  constructor(options: QuestDayCutoffControllerOptions) {
    this.timeZone = resolveQuestTimeZone(options.timeZone);
    this.getNow = options.getNow ?? Date.now;
    this.getRouteContext = options.getRouteContext;
    this.onDayChanged = options.onDayChanged;
    this.onQuestCutoff = options.onQuestCutoff;
    this.onError =
      options.onError ??
      ((error) => console.warn("Quest day cutoff callback failed", error));
    this.schedule = options.schedule ?? setTimeout;
    this.cancel = options.cancel ?? clearTimeout;
  }

  start() {
    if (this.started) return;

    const now = this.getNow();
    this.currentDayKey = getQuestDayKey(now, this.timeZone);
    this.started = true;
    this.scheduleNextCheck(now);
  }

  checkNow() {
    if (!this.started || !this.currentDayKey) return;

    const now = this.getNow();
    const nextDayKey = getQuestDayKey(now, this.timeZone);
    let callbackError: unknown;
    if (nextDayKey !== this.currentDayKey) {
      const event = {
        previousDayKey: this.currentDayKey,
        currentDayKey: nextDayKey,
      };
      const routeContext = this.getRouteContext();

      this.currentDayKey = nextDayKey;
      if (isQuestExperiencePath(routeContext)) {
        try {
          this.onQuestCutoff(event, routeContext);
        } catch (error) {
          callbackError = error;
        }
      }
      try {
        this.onDayChanged(event);
      } catch (error) {
        callbackError ??= error;
      }
    }

    this.scheduleNextCheck(now);
    if (callbackError) this.onError(callbackError);
  }

  stop() {
    this.started = false;
    this.currentDayKey = null;
    if (this.timer !== null) {
      this.cancel(this.timer);
      this.timer = null;
    }
  }

  private scheduleNextCheck(now: number) {
    if (!this.started) return;

    if (this.timer !== null) {
      this.cancel(this.timer);
    }

    const boundaryMs = getNextQuestDayBoundaryMs(now, this.timeZone);
    this.timer = this.schedule(() => {
      this.timer = null;
      this.checkNow();
    }, Math.max(1, boundaryMs - now));
  }
}
