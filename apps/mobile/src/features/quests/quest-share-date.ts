const QUEST_SHARE_DATE_FORMAT_OPTIONS = {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
  year: "numeric",
} as const;

const QUEST_SHARE_DATE_FORMATTERS = {
  en: new Intl.DateTimeFormat("en-US", QUEST_SHARE_DATE_FORMAT_OPTIONS),
  fr: new Intl.DateTimeFormat("fr-FR", QUEST_SHARE_DATE_FORMAT_OPTIONS),
} as const;

type ResolveQuestShareDateKeyOptions = {
  archive?: boolean;
  deviceNow?: Date;
  questDateKey?: string | null;
};

export function resolveQuestShareDateKey({
  archive = false,
  deviceNow = new Date(),
  questDateKey,
}: ResolveQuestShareDateKeyOptions): string | undefined {
  if (archive) {
    return questDateKey ?? undefined;
  }

  if (Number.isNaN(deviceNow.getTime())) {
    return questDateKey ?? undefined;
  }

  const year = deviceNow.getFullYear();
  const month = String(deviceNow.getMonth() + 1).padStart(2, "0");
  const day = String(deviceNow.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatQuestShareDate(
  dateKey: string | null | undefined,
  locale: string,
): string | undefined {
  if (!dateKey) return undefined;

  const parts = dateKey.split("-").map((part) => Number(part));
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (!year || !month || !day) return dateKey;

  const formatter = locale.startsWith("fr")
    ? QUEST_SHARE_DATE_FORMATTERS.fr
    : QUEST_SHARE_DATE_FORMATTERS.en;

  return formatter.format(new Date(Date.UTC(year, month - 1, day)));
}
