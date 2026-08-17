const rankings = {
  title: "Classements",
  subtitle: "Compare tes résultats à ceux des autres aventuriers.",
  previewLabel: "Aperçu du classement",
  loadingTitle: "Rassemblement des aventuriers",
  loadingBody: "Chargement des derniers classements provisoires et clôturés.",
  you: "Toi",
  liveProvisional: "En direct · Provisoire",
  final: "Final",
  provisionalHint:
    "Les résultats évoluent à mesure que les parties sont validées.",
  finalHint: "Cette période est clôturée et ne change plus.",
  closesIn: "Clôture dans {days} j {hours} h {minutes} min",
  weekEnding: "Semaine se terminant le {date}",
  recentDays: "Jours clôturés récents",
  viewDays: "Voir les résultats quotidiens",
  hideDays: "Masquer les résultats quotidiens",
  scoringHelp: "Comment fonctionne le classement",
  profileTapHint: "Touche un aventurier pour voir ses couronnes et ses succès",
  historyTitle: "Historique des classements",
  historyBody:
    "Aucun jour ni aucune semaine de compétition clôturés pour le moment.",
  periods: {
    daily: "Quotidien",
    weekly: "Hebdomadaire",
    today: "Aujourd'hui",
    yesterday: "Hier",
    current_week: "Cette semaine",
    last_week: "Semaine dernière",
    history: "Historique",
  },
  boards: {
    allQuests: "Toutes les quêtes",
    steps: "Pas",
    dailyNumbers: "Nombre du jour",
    wordle: "Wordle",
    speedCalculus: "Calcul rapide",
    perfectTiming: "Timing parfait",
  },
  modes: {
    combined: "Combiné",
    french: "Français",
    english: "Anglais",
  },
  results: {
    steps: "{count} pas",
    oneGuess: "{count} essai",
    guesses: "{count} essais",
    seconds: "{seconds} s",
    minutesSeconds: "{minutes} min {seconds} s",
    notExact: "Non exact",
  },
  help: {
    title: "Comment fonctionne le classement",
    intro:
      "Chaque résultat classé accepté est converti en points. Les totaux les plus élevés passent devant et les points affichés sont arrondis à l’entier avant de départager les égalités.",
    participationTitle: "Participer et suivre le direct",
    participationBody:
      "Un seul résultat accepté suffit pour apparaître. Un résultat accepté à zéro point compte aussi, contrairement aux résultats rejetés, d’entraînement, exclus ou non admissibles.",
    participationLive:
      "Les périodes ouvertes sont provisoires. Elles s’actualisent environ chaque minute, au retour sur l’écran, et à tout moment en tirant vers le bas.",
    allQuestsTitle: "Toutes les quêtes",
    allQuestsFormula:
      "Toutes les quêtes = Pas + Nombre du jour combiné + Wordle combiné + Calcul rapide + Timing parfait",
    allQuestsBody:
      "Chaque famille de quête compte une fois. Une famille manquante ajoute zéro, sans plafond ni sélection des meilleurs résultats, et ce classement général n’accorde pas de Couronne supplémentaire.",
    stepsTitle: "Pas",
    stepsFormula: "Points = nombre de pas ÷ 20",
    stepsBody:
      "Le résultat est arrondi au point entier le plus proche. Il n’y a aucun plafond : 10 000 pas rapportent 500 points et 100 000 pas en rapportent 5 000.",
    dailyNumbersTitle: "Nombre du jour",
    dailyNumbersFormulaFast:
      "Sous 10 secondes : points = 1 000 × (10 ÷ temps en secondes)^0,30",
    dailyNumbersFormulaSlow:
      "À partir de 10 secondes : points = 1 000 × (10 ÷ temps en secondes)^0,75",
    dailyNumbersBody:
      "Seule une solution exacte marque des points. Les trois modes utilisent la même courbe ; Combiné additionne les points de 1–5, 2–4 et 3–3. Un mode manquant ajoute zéro.",
    wordleTitle: "Wordle",
    wordleFormula:
      "1 / 2 / 3 / 4 / 5 / 6 essais = 1 200 / 1 000 / 800 / 600 / 400 / 200 points",
    wordleBody:
      "Un échec rapporte zéro. Le français et l’anglais utilisent le même barème ; Combiné additionne les deux scores, avec zéro pour une langue manquante.",
    speedCalculusTitle: "Calcul rapide",
    speedCalculusFormula: "Points = bonnes réponses × 50",
    speedCalculusBody:
      "Chaque bonne réponse compte et le score n’a aucun plafond.",
    perfectTimingTitle: "Timing parfait",
    perfectTimingFormula:
      "Points = 100 + 1 100 × (300 − erreur absolue en ms) ÷ 300",
    perfectTimingBody:
      "Une réussite entre 0 et 300 ms d’erreur rapporte de 1 200 à 100 points. Un échec rapporte zéro.",
    periodsTitle: "Quotidien, hebdomadaire et clôture",
    periodsDaily:
      "Le classement quotidien utilise la date de compétition du fuseau verrouillé de chaque joueur. Aujourd’hui et Hier peuvent être provisoires en même temps.",
    periodsWeekly:
      "L’hebdomadaire additionne tous les résultats quotidiens admissibles du lundi au dimanche. Un seul résultat suffit, sans règle des trois meilleurs ni plafond hebdomadaire.",
    periodsCutoff:
      "Une date devient définitive le lendemain à 13 h UTC : le changement de date mondial se termine à 12 h UTC, puis une heure est réservée à la dernière synchronisation des pas. Une semaine devient définitive le lundi à 13 h UTC.",
    periodsHistory:
      "Les classements quotidiens et hebdomadaires définitifs se trouvent dans l’Historique. Une place provisoire n’accorde jamais de médaille ni de Couronne ; elles sont attribuées seulement après la clôture d’un classement hebdomadaire avec récompenses.",
  },
  profile: {
    title: "Profil du joueur",
    loadingTitle: "Recherche de cet aventurier",
    loadingBody: "Chargement de son profil de jeu public.",
    adventurer: "Aventurier",
    publicGameProfile: "Profil de jeu public",
    crownsTitle: "Couronnes",
    crownsSubtitle:
      "Récompenses propres à chaque quête gagnées sur les podiums hebdomadaires.",
    totalCrowns: "Total des couronnes",
    nonTradable: "Non échangeables",
    achievementsTitle: "Succès",
    achievementsSubtitle: "Classements hebdomadaires or, argent et bronze.",
    medals: {
      gold: "Or",
      silver: "Argent",
      bronze: "Bronze",
    },
    recentPlacements: "Classements hebdomadaires récents",
    personalBests: "Records personnels",
    noPlacements: "Aucun classement hebdomadaire clôturé pour le moment.",
    noPersonalBests: "Aucun record personnel pour le moment.",
    boardLabels: {
      dailyNumbers15: "Nombre du jour · 1–5",
      dailyNumbers24: "Nombre du jour · 2–4",
      dailyNumbers33: "Nombre du jour · 3–3",
      wordleFr: "Wordle · Français",
      wordleEn: "Wordle · Anglais",
    },
  },
};

export default rankings;
