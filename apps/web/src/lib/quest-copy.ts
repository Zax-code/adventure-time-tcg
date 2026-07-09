const questTitles: Record<string, string> = {
  steps_10k: "Walk 10,000 steps",
  daily_login: "Daily login",
  wordle_daily: "Complete a Wordle",
  wordle_daily_fr: "Complete the French Wordle",
  wordle_daily_en: "Complete the English Wordle",
  speed_calculus_daily: "Speed Calculus sprint",
  daily_numbers_1_5: "Daily Numbers: 1–5",
  daily_numbers_2_4: "Daily Numbers: 2–4",
  daily_numbers_3_3: "Daily Numbers: 3–3",
};

const questDescriptions: Record<string, string> = {
  steps_10k: "Walk 10,000 steps today and sync a supported step source.",
  daily_login: "Sign in today, then claim the reward when the visit is counted.",
  wordle_daily: "Guess today's five-letter word in six tries.",
  wordle_daily_fr: "Guess today's French five-letter word in six tries.",
  wordle_daily_en: "Guess today's English five-letter word in six tries.",
  speed_calculus_daily: "Complete a timed arithmetic run and lock your latest score.",
  daily_numbers_1_5: "Use one large and five small numbers to approach the target.",
  daily_numbers_2_4: "Use two large and four small numbers to approach the target.",
  daily_numbers_3_3: "Use three large and three small numbers to approach the target.",
};

function humanize(value: string) {
  const words = value.replace(/_desc$/, "").replaceAll("_", " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Daily quest";
}

export function getQuestTitle(quest: { title: string; type: string }) {
  return questTitles[quest.title] ?? questTitles[quest.type] ?? humanize(quest.title || quest.type);
}

export function getQuestDescription(quest: { description: string; type: string }) {
  return questDescriptions[quest.type] ?? (quest.description.endsWith("_desc") ? humanize(quest.description) : quest.description);
}
