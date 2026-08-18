const rankings = {
  title: "Rankings",
  subtitle: "See how you stack up against other adventurers.",
  previewLabel: "Preview standings",
  loadingTitle: "Gathering the adventurers",
  loadingBody: "Loading the latest closed and provisional standings.",
  you: "You",
  liveProvisional: "Live · Provisional",
  final: "Final",
  provisionalHint: "Results update as accepted games arrive.",
  finalHint: "This period is closed and no longer changes.",
  closesIn: "Closes in {days}d {hours}h {minutes}m",
  weekEnding: "Week ending {date}",
  recentDays: "Recent closed days",
  viewDays: "View daily results",
  hideDays: "Hide daily results",
  scoringHelp: "How the leaderboard works",
  profileTapHint: "Tap any adventurer to see their crowns and achievements",
  historyTitle: "Leaderboard history",
  historyBody: "No closed competition days or weeks yet.",
  periods: {
    daily: "Daily",
    weekly: "Weekly",
    today: "Today",
    yesterday: "Yesterday",
    current_week: "This week",
    last_week: "Last week",
    history: "History",
  },
  boards: {
    allQuests: "All quests",
    steps: "Steps",
    dailyNumbers: "Daily Numbers",
    wordle: "Wordle",
    speedCalculus: "Speed Calculus",
    perfectTiming: "Perfect Timing",
  },
  modes: {
    combined: "Combined",
    french: "French",
    english: "English",
  },
  results: {
    steps: "{count} steps",
    oneGuess: "{count} guess",
    guesses: "{count} guesses",
    seconds: "{seconds} s",
    minutesSeconds: "{minutes} min {seconds} s",
    notExact: "Not exact",
  },
  help: {
    title: "How the leaderboard works",
    intro:
      "Every accepted ranked result is converted into points. Higher point totals rank first, and displayed points are rounded to whole numbers before ties are decided.",
    participationTitle: "Joining and live standings",
    participationBody:
      "One accepted result is enough to appear. Zero-point accepted results still count; rejected, training, excluded, or ineligible results do not.",
    participationLive:
      "Open periods are provisional. They refresh about once a minute, refresh when you return to the screen, and can always be refreshed by pulling down.",
    allQuestsTitle: "All Quests",
    allQuestsFormula:
      "All Quests = Steps + Daily Numbers Combined + Wordle Combined + Speed Calculus + Perfect Timing",
    allQuestsBody:
      "Each quest family is counted once. Missing families add zero, there is no cap or best-subset rule, and this overall board does not grant an extra Crown.",
    stepsTitle: "Steps",
    stepsFormula: "Points = steps ÷ 20",
    stepsBody:
      "The result is rounded to the nearest whole point. The score has no ceiling: 10,000 steps earns 500 points and 100,000 steps earns 5,000 points.",
    dailyNumbersTitle: "Daily Numbers",
    dailyNumbersFormulaFast:
      "Under 10 seconds: points = 1,000 × (10 ÷ time in seconds)^0.30",
    dailyNumbersFormulaSlow:
      "At 10 seconds or more: points = 1,000 × (10 ÷ time in seconds)^0.75",
    dailyNumbersBody:
      "Only an exact solution scores. All three modes use the same curve; Combined adds the points from 1–5, 2–4, and 3–3. A missing mode adds zero.",
    wordleTitle: "Wordle",
    wordleFormula:
      "1 / 2 / 3 / 4 / 5 / 6 guesses = 1,200 / 1,000 / 800 / 600 / 400 / 200 points",
    wordleBody:
      "A failed puzzle earns zero. English and French use the same table; Combined adds both language scores, with a missing language adding zero.",
    speedCalculusTitle: "Speed Calculus",
    speedCalculusFormula: "Points = correct answers × 50",
    speedCalculusBody:
      "Every correct answer counts and there is no score ceiling.",
    perfectTimingTitle: "Perfect Timing",
    perfectTimingFormula:
      "Points = 100 + 1,100 × (300 − absolute error in ms) ÷ 300",
    perfectTimingBody:
      "Successful results from 0 to 300 ms error earn 1,200 down to 100 points. A miss earns zero.",
    periodsTitle: "Daily, weekly, and the cutoff",
    periodsDaily:
      "Daily uses the competition date in each player's locked timezone. Today and Yesterday may both be provisional.",
    periodsWeekly:
      "Weekly adds every eligible daily result from Monday through Sunday. One result is enough; there is no best-three rule or weekly ceiling.",
    periodsCutoff:
      "A date becomes final at 13:00 UTC the next day: worldwide date rollover completes by 12:00 UTC, followed by one hour for final Step synchronization. A week becomes final Monday at 13:00 UTC.",
    periodsHistory:
      "Final daily and weekly boards live in History. Provisional placements never award medals or Crowns; those are awarded only after a prize-enabled weekly board becomes final.",
  },
  profile: {
    title: "Player profile",
    loadingTitle: "Finding this adventurer",
    loadingBody: "Loading their public game profile.",
    adventurer: "Adventurer",
    publicGameProfile: "Public game profile",
    crownsTitle: "Crowns",
    crownsSubtitle:
      "Quest-specific rewards earned from weekly podium finishes.",
    totalCrowns: "Total crowns",
    nonTradable: "Non-tradable",
    achievementsTitle: "Achievements",
    achievementsSubtitle:
      "Gold, silver, and bronze weekly leaderboard finishes.",
    medals: {
      gold: "Gold",
      silver: "Silver",
      bronze: "Bronze",
    },
    recentPlacements: "Recent weekly placements",
    personalBests: "Personal bests",
    noPlacements: "No closed weekly placements yet.",
    noPersonalBests: "No personal bests yet.",
    boardLabels: {
      dailyNumbers15: "Daily Numbers · 1–5",
      dailyNumbers24: "Daily Numbers · 2–4",
      dailyNumbers33: "Daily Numbers · 3–3",
      wordleFr: "Wordle · French",
      wordleEn: "Wordle · English",
    },
  },
};

export default rankings;
