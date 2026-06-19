import { z } from "zod";

export const stepSourceSchema = z.enum(["device_health", "fitbit"]);
export const localeSchema = z.enum(["en", "fr"]);
export const notificationPreferencesSchema = z.object({
  dailyReset: z.boolean(),
  stepGoal: z.boolean(),
  pvpInvite: z.boolean(),
  pvpTurn: z.boolean(),
  giftReceived: z.boolean(),
});

export const authUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  avatarAssetId: z.string().nullable(),
  coins: z.number().int().nonnegative(),
  dust: z.number().int().nonnegative(),
  isAdmin: z.boolean(),
  isSuperAdmin: z.boolean(),
  preferredStepSource: stepSourceSchema,
  preferredLanguage: localeSchema,
  timezone: z.string().min(1),
  notificationPreferences: notificationPreferencesSchema,
});

export type AuthUser = z.infer<typeof authUserSchema>;
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresInSeconds: z.number().int().positive(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerSchema = loginSchema.extend({
  displayName: z.string().min(1).max(64),
  preferredLanguage: localeSchema.default("en"),
});

export const verifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
});

export const resendVerificationSchema = z.object({
  email: z.string().email(),
});

export const requestPasswordResetSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
  password: z.string().min(8),
});

export const googleAuthSchema = z
  .object({
    idToken: z.string().min(1).optional(),
    accessToken: z.string().min(1).optional(),
    preferredLanguage: localeSchema.default("en"),
  })
  .refine((value) => Boolean(value.idToken || value.accessToken), {
    message: "Either idToken or accessToken is required.",
  });

export const raritySchema = z.object({
  id: z.string(),
  name: z.string(),
  dropRate: z.number(),
  color: z.string(),
});

export const cardTypeValues = [
  "Hero",
  "Tech",
  "Royalty",
  "Candy",
  "Undead",
  "Ice",
  "Fire",
  "Magic",
  "Demon",
  "Cosmic",
] as const;

export const cardTypeSchema = z.enum(cardTypeValues);
export type CardType = z.infer<typeof cardTypeSchema>;

export const rarityNameValues = [
  "Common",
  "Uncommon",
  "Rare",
  "Epic",
  "Legendary",
] as const;

export const rarityNameSchema = z.enum(rarityNameValues);

export const pvpStatusNameValues = [
  "Burn",
  "Freeze",
  "Shield",
  "GuardUp",
  "Vulnerable",
  "Weakened",
  "Haste",
  "Taunt",
  "Regeneration",
  "Regen",
  "Silence",
  "SummoningSickness",
  "Cover",
  "Stunned",
  "Poison",
  "Thorns",
  "Stealth",
  "Empower",
  "Counter",
  "Mark",
  "Barrier",
  "Doom",
] as const;

export const pvpStatusNameSchema = z.enum(pvpStatusNameValues);

export const passiveTriggerValues = [
  "onBattleInit",
  "onBattleStart",
  "onStartTurn",
  "onEndTurn",
  "onDamageTaken",
  "onDamageDealt",
  "onDealDamage",
  "onBelowHp",
  "onAllyKo",
  "onEnemyKo",
  "onAnyKo",
  "onAllyFatalDamage",
  "onHealAlly",
  "onStatusApplied",
  "onActionStart",
] as const;

export const passiveTriggerSchema = z.enum(passiveTriggerValues);

export const abilityTargetValues = [
  "self",
  "ally",
  "enemy",
  "any",
  "allAllies",
  "allEnemies",
  "all",
] as const;

export const abilityTargetSchema = z.enum(abilityTargetValues);

export const abilityTargetSelectorValues = [
  "lowestHp",
  "highestHp",
  "lowestAtk",
  "highestAtk",
  "lowestDef",
  "highestDef",
  "lowestSpd",
  "highestSpd",
] as const;

export const abilityTargetSelectorSchema = z.enum(
  abilityTargetSelectorValues,
);

export const pvpCombatEventTypeValues = [
  "matchStart",
  "turnStart",
  "turnEnd",
  "energyGrant",
  "statusTick",
  "statusApply",
  "statusExpire",
  "statusCleanse",
  "abilityStart",
  "damage",
  "crit",
  "shieldAbsorb",
  "heal",
  "ko",
  "swap",
  "formation",
  "passiveTrigger",
  "cooldownTick",
  "gameOver",
  "freeze_skip",
  "stun_consume",
  "revive",
  "pass",
  "concede",
  "coverRedirect",
  "thorns",
  "counter",
  "preventDeath",
  "statusSteal",
  "swapHp",
] as const;

export const pvpCombatEventTypeSchema = z.enum(pvpCombatEventTypeValues);

export const cardAbilityDefinitionSchema = z.object({
  key: z.string(),
  name: z.string(),
  nameFr: z.string().nullable().optional(),
  description: z.string(),
  descriptionFr: z.string().nullable().optional(),
  type: z.enum(["PASSIVE", "SKILL", "ULTIMATE"]),
  cost: z.number().int(),
  cooldown: z.number().int().nullable().optional(),
  oncePerMatch: z.boolean(),
});

const pvpPayloadStatusSpecSchema = z
  .object({
    name: pvpStatusNameSchema,
    duration: z.number().optional(),
    magnitude: z.number().optional(),
    target: abilityTargetSchema.optional(),
    targetSelector: abilityTargetSelectorSchema.optional(),
  })
  .passthrough();

const pvpPayloadRandomStatusSpecSchema = z
  .object({
    name: pvpStatusNameSchema,
    duration: z.number().optional(),
    magnitude: z.number().optional(),
  })
  .passthrough();

const pvpPayloadTeamDebuffSpecSchema = z
  .object({
    name: pvpStatusNameSchema,
    duration: z.number(),
    magnitude: z.number().optional(),
  })
  .passthrough();

const pvpPayloadTeamBuffSpecSchema = z
  .object({
    name: pvpStatusNameSchema,
    duration: z.number(),
    target: z.enum(["self", "allAllies", "lowestHpAlly"]).optional(),
  })
  .passthrough();

const pvpPayloadSelfBuffSpecSchema = z
  .object({
    name: pvpStatusNameSchema,
    duration: z.number(),
  })
  .passthrough();

const pvpPayloadCleanseSchema = z
  .object({
    count: z.number(),
    target: z.enum(["self", "ally", "allAllies", "allEnemies"]),
  })
  .passthrough();

const pvpPayloadStatBonusSchema = z
  .object({
    hp: z.number().optional(),
    attack: z.number().optional(),
    defense: z.number().optional(),
    speed: z.number().optional(),
  })
  .passthrough();

const pvpPayloadAdjacentAuraStatusSchema = z
  .object({
    name: pvpStatusNameSchema,
    duration: z.number(),
  })
  .passthrough();

const pvpPayloadConditionSchema = z
  .object({
    targetHas: pvpStatusNameSchema.optional(),
    selfHas: pvpStatusNameSchema.optional(),
    allyType: cardTypeSchema.optional(),
    selfBelowHpPct: z.number().optional(),
    targetBelowHpPct: z.number().optional(),
  })
  .passthrough();

const pvpPayloadConditionalEffectSchema = z
  .object({
    when: pvpPayloadConditionSchema,
    addApplyStatuses: z.array(pvpPayloadStatusSpecSchema).optional(),
    damageMulDelta: z.number().optional(),
  })
  .passthrough();

export const pvpAbilityPayloadSchema = z
  .object({
    damageMul: z.number().optional(),
    ignoreDefensePct: z.number().optional(),
    burnBonusMul: z.number().optional(),
    splashPct: z.number().optional(),
    affectsAllEnemies: z.boolean().optional(),
    affectsAllAllies: z.boolean().optional(),
    lineOnly: z.boolean().optional(),
    hits: z.number().optional(),
    executeDamageMul: z.number().optional(),
    executeThreshold: z.number().optional(),
    healPctOfMaxHpOnExecute: z.number().optional(),
    target: abilityTargetSchema.optional(),
    targetSelector: abilityTargetSelectorSchema.optional(),
    applyStatuses: z.array(pvpPayloadStatusSpecSchema).optional(),
    randomDebuffs: z.array(pvpPayloadRandomStatusSpecSchema).optional(),
    randomStatuses: z.array(pvpPayloadRandomStatusSpecSchema).optional(),
    instantKoIfTargetBelowHpPct: z.number().optional(),
    applyStatusesToAttacker: z
      .array(pvpPayloadRandomStatusSpecSchema)
      .optional(),
    onBasicOnly: z.boolean().optional(),
    increaseTargetCooldowns: z.number().optional(),
    applyStatusChance: z.number().optional(),
    teamDebuffsAllEnemies: z.array(pvpPayloadTeamDebuffSpecSchema).optional(),
    teamBuffs: z.array(pvpPayloadTeamBuffSpecSchema).optional(),
    selfBuffs: z.array(pvpPayloadSelfBuffSpecSchema).optional(),
    shieldTarget: z.enum(["self", "target", "allAllies"]).optional(),
    shieldPctOfMaxHp: z.number().optional(),
    healPctOfDamage: z.number().optional(),
    healPctOfMaxHp: z.number().optional(),
    healLowestAllyPctOfDamage: z.number().optional(),
    healLowestHpAllyPctOfMaxHp: z.number().optional(),
    healingBonus: z.number().optional(),
    cleanse: pvpPayloadCleanseSchema.optional(),
    alsoCleanseAllEnemies: z.boolean().optional(),
    cleanseAllStatuses: z.boolean().optional(),
    revivePct: z.number().optional(),
    reviveAllyOnEnemyKoPct: z.number().optional(),
    reduceCooldowns: z.number().optional(),
    reduceEnemyCooldowns: z.number().optional(),
    selfDamagePct: z.number().optional(),
    stealBuffCount: z.number().optional(),
    swapHpPercentages: z.boolean().optional(),
    trigger: passiveTriggerSchema.optional(),
    thresholdPct: z.number().optional(),
    belowHpThreshold: z.number().optional(),
    once: z.boolean().optional(),
    chance: z.number().optional(),
    lifestealPct: z.number().optional(),
    preventDeath: z.boolean().optional(),
    allowBarrierOnPreventDeath: z.boolean().optional(),
    debuffImmunityCount: z.number().optional(),
    bonusCritChanceBasic: z.number().optional(),
    battleStartEnergyBonus: z.number().optional(),
    statBonusTarget: z.enum(["self", "allAllies", "allEnemies"]).optional(),
    requiredAnyAllyTypes: z.array(cardTypeSchema).optional(),
    applyToAllyTypes: z.array(cardTypeSchema).optional(),
    adjacentAuraStatus: pvpPayloadAdjacentAuraStatusSchema.optional(),
    redirectIncomingChance: z.number().optional(),
    redirectIfSelfAboveHpPct: z.number().optional(),
    bonusDamageVsDebuffedTargetsPct: z.number().optional(),
    evasionChance: z.number().optional(),
    statBonus: pvpPayloadStatBonusSchema.optional(),
    statBonusDurationMode: z
      .enum(["permanent", "whileSourceActive"])
      .optional(),
    damageReduction: z.number().optional(),
    hitCountLimit: z.number().optional(),
    conditional: z.array(pvpPayloadConditionalEffectSchema).optional(),
    copyAbilityType: z.enum(["SKILL", "ULTIMATE"]).optional(),
    copyAbilitySource: z.enum(["enemy", "ally", "either"]).optional(),
  })
  .passthrough();

export const cardAbilitiesSchema = z.object({
  passive: cardAbilityDefinitionSchema.nullable(),
  skill: cardAbilityDefinitionSchema.nullable(),
  ultimate: cardAbilityDefinitionSchema.nullable(),
});

export const cardSchema = z.object({
  id: z.string(),
  name: z.string(),
  character: z.string(),
  description: z.string(),
  hp: z.number().int(),
  attack: z.number().int(),
  defense: z.number().int(),
  speed: z.number().int(),
  type: cardTypeSchema,
  rarity: raritySchema,
  imageAssetId: z.string().nullable(),
  abilities: cardAbilitiesSchema.nullable().optional(),
});

export const collectionEntrySchema = z.object({
  id: z.string(),
  cardId: z.string(),
  quantity: z.number().int().nonnegative(),
  obtainedAt: z.string().nullable(),
  card: cardSchema,
});

export const collectionStatsSchema = z.object({
  totalCards: z.number().int().nonnegative(),
  uniqueOwned: z.number().int().nonnegative(),
  completionPercentage: z.number().int().min(0).max(100),
});

export const collectionResponseSchema = z.object({
  cards: z.array(collectionEntrySchema),
  dust: z.number().int().nonnegative(),
  stats: collectionStatsSchema,
});

export const userSummarySchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string(),
});

export const usersResponseSchema = z.object({
  users: z.array(userSummarySchema),
});

export const dustActionSchema = z.object({
  cardId: z.string().min(1),
  quantity: z.number().int().positive().default(1),
});

export const craftRecycleResponseSchema = z.object({
  success: z.boolean(),
  cardId: z.string(),
  newDustBalance: z.number().int().nonnegative(),
  quantityCrafted: z.number().int().positive().optional(),
  quantityRecycled: z.number().int().positive().optional(),
  dustGained: z.number().int().nonnegative().optional(),
  dustSpent: z.number().int().nonnegative().optional(),
});

export const giftSchema = z.object({
  id: z.string(),
  cardId: z.string(),
  quantity: z.number().int().positive(),
  message: z.string().nullable(),
  status: z.string(),
  createdAt: z.string(),
  fromUser: userSummarySchema,
  toUser: userSummarySchema,
  card: z.object({
    id: z.string(),
    name: z.string(),
    character: z.string(),
    rarity: raritySchema,
  }),
});

export const giftsResponseSchema = z.object({
  gifts: z.array(giftSchema),
  pendingCount: z.number().int().nonnegative(),
});

export const sendGiftSchema = z.object({
  cardId: z.string().min(1),
  toUserId: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  message: z.string().optional(),
});

export const processGiftSchema = z.object({
  giftId: z.string().min(1),
  action: z.enum(["accept", "reject"]),
});

export const packSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  cardCount: z.number().int().positive(),
  cost: z.number().int().nonnegative(),
  color: z.string(),
  isActive: z.boolean(),
  guaranteedRarity: z.string().nullable(),
  packArtAssetId: z.string().nullable(),
});

export const cardBackVisualSchema = z.object({
  themeName: z.enum(["candy", "ice", "nightosphere"]),
  rarityName: z.enum(["Common", "Uncommon", "Rare", "Epic", "Legendary"]),
  imageAssetId: z.string().nullable(),
});

export const packsResponseSchema = z.object({
  packs: z.array(packSchema),
  cardBackVisuals: z.array(cardBackVisualSchema),
});

export const adminPackSchema = packSchema;

export const adminPacksResponseSchema = z.object({
  packs: z.array(adminPackSchema),
});

export const adminPackEditSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  cardCount: z.number().int().positive(),
  cost: z.number().int().nonnegative(),
  color: z.string().min(1),
  isActive: z.boolean().optional(),
  guaranteedRarity: z.string().nullable().optional(),
  packArtAssetId: z.string().nullable().optional(),
});

export const openedCardSchema = cardSchema.extend({
  isNewForUser: z.boolean(),
});

export const openPackSchema = z.object({
  packId: z.string().min(1),
});

export const openPackResponseSchema = z.object({
  pack: packSchema,
  cards: z.array(openedCardSchema),
  newBalance: z.number().int().nonnegative(),
});

export const dailyClaimStatusSchema = z.object({
  coins: z.number().int().nonnegative(),
  canClaim: z.boolean(),
  timeUntilNextClaim: z.number().int().nonnegative(),
  dailyReward: z.number().int().nonnegative(),
  timezone: z.string(),
});

export const dailyClaimResponseSchema = z.object({
  success: z.boolean(),
  coinsAwarded: z.number().int().nonnegative(),
  newBalance: z.number().int().nonnegative(),
});

export const dailyClaimConflictSchema = z.object({
  error: z.string(),
  code: z.literal("DAILY_ALREADY_CLAIMED"),
  timeUntilNextClaim: z.number().int().nonnegative(),
  timezone: z.string(),
});

export const questSchema = z.object({
  id: z.string(),
  version: z.string(),
  type: z.string(),
  title: z.string(),
  description: z.string(),
  target: z.number().int().nonnegative(),
  progress: z.number().int().nonnegative(),
  completed: z.boolean(),
  claimed: z.boolean(),
  reward: z.number().int().nonnegative(),
  icon: z.string(),
  actionPath: z.string().nullable(),
  failed: z.boolean(),
  attemptsUsed: z.number().int().nonnegative().optional(),
  runsUsed: z.number().int().nonnegative().optional(),
  maxRuns: z.number().int().nonnegative().optional(),
  latestScore: z.number().int().nonnegative().optional(),
  rewardPreview: z.number().int().nonnegative().optional(),
  locked: z.boolean().optional(),
  mode: z.enum(["classic", "expert"]).optional(),
  score: z.number().int().nonnegative().optional(),
  distance: z.number().int().nonnegative().optional(),
  finalValue: z.number().int().positive().optional(),
  resetByName: z.string().nullable().optional(),
});

export const questsResponseSchema = z.object({
  quests: z.array(questSchema),
  fitbitConnected: z.boolean(),
});

export const fitbitStatusResponseSchema = z.object({
  connected: z.boolean(),
  userId: z.string().optional(),
  connectedAt: z.string().optional(),
});

export const fitbitAuthorizeSchema = z.object({
  redirectUri: z.string().min(1),
});

export const fitbitAuthorizeResponseSchema = z.object({
  authorizeUrl: z.string().min(1),
});

export const fitbitDisconnectResponseSchema = z.object({
  success: z.boolean(),
});

export const claimQuestSchema = z.object({
  questId: z.string().min(1),
});

export const claimQuestResponseSchema = z.object({
  success: z.boolean(),
  reward: z.number().int().nonnegative(),
  newBalance: z.number().int().nonnegative(),
  quest: z.object({
    id: z.string(),
    type: z.string(),
    completed: z.boolean(),
    claimed: z.boolean(),
  }),
});

export const wordleLetterStateSchema = z.enum(["correct", "present", "absent"]);
export const wordleLocaleSchema = z.enum(["fr", "en"]);
export const wordleGuessSchema = z.object({
  guess: z.string(),
  evaluation: z.array(wordleLetterStateSchema),
});

export const wordleStateResponseSchema = z.object({
  locale: wordleLocaleSchema,
  availableLocales: z.array(wordleLocaleSchema),
  date: z.string(),
  resetTimezone: z.string(),
  guesses: z.array(wordleGuessSchema),
  solved: z.boolean(),
  targetWord: z.string().nullable().optional(),
  questVersion: z.string().nullable().optional(),
  resetByName: z.string().nullable().optional(),
});

export const wordleDefinitionVariantSchema = z.object({
  displayWord: z.string(),
  definition: z.string(),
  partOfSpeech: z.string().nullable().optional(),
  sourceName: z.string(),
  sourceUrl: z.string().url(),
});

export const wordleDefinitionResponseSchema = z.object({
  locale: wordleLocaleSchema,
  word: z.string(),
  displayWord: z.string(),
  definition: z.string(),
  partOfSpeech: z.string().nullable().optional(),
  sourceName: z.string(),
  sourceUrl: z.string().url(),
  variants: z.array(wordleDefinitionVariantSchema).min(1),
});

export const wordleSubmitSchema = z.object({
  locale: wordleLocaleSchema.optional(),
  guess: z.string().min(1),
  expectedDate: z.string().optional(),
  questVersion: z.string().optional(),
});

export const wordleSubmitResponseSchema = z.object({
  locale: wordleLocaleSchema,
  evaluation: z.array(wordleLetterStateSchema),
  solved: z.boolean(),
  date: z.string(),
  questJustCompleted: z.boolean(),
  targetWord: z.string().nullable().optional(),
});

export const dailyNumbersModeSchema = z.enum(["classic", "expert"]);
export const dailyNumbersOperatorSchema = z.enum(["+", "-", "*", "/"]);

export const dailyNumbersTileSchema = z.object({
  id: z.string(),
  value: z.number().int().positive(),
  source: z.enum(["initial", "derived"]),
  status: z.enum(["available", "used"]),
});

export const dailyNumbersStepInputSchema = z.object({
  leftId: z.string().min(1),
  operator: dailyNumbersOperatorSchema,
  rightId: z.string().min(1),
  resultId: z.string().min(1),
});

export const dailyNumbersStepSchema = dailyNumbersStepInputSchema.extend({
  leftValue: z.number().int().positive(),
  rightValue: z.number().int().positive(),
  resultValue: z.number().int().positive(),
});

export const dailyNumbersSubmissionSchema = z.object({
  finalValue: z.number().int().positive(),
  distance: z.number().int().nonnegative(),
  exact: z.boolean(),
  score: z.number().int().nonnegative(),
  completed: z.boolean(),
  steps: z.array(dailyNumbersStepSchema),
  officialSolutionUnlocked: z.boolean(),
  officialSolutionSteps: z.array(dailyNumbersStepSchema),
});

export const dailyNumbersStateResponseSchema = z.object({
  mode: dailyNumbersModeSchema,
  date: z.string(),
  resetTimezone: z.string(),
  target: z.number().int().min(101).max(999),
  numbers: z.array(dailyNumbersTileSchema).length(6),
  generationAttempt: z.number().int().positive(),
  bestValue: z.number().int().positive(),
  bestDistance: z.number().int().nonnegative(),
  questVersion: z.string().nullable().optional(),
  resetByName: z.string().nullable().optional(),
  reward: z.number().int().nonnegative(),
  claimed: z.boolean(),
  completed: z.boolean(),
  submitted: z.boolean(),
  submission: dailyNumbersSubmissionSchema.nullable(),
});

export const dailyNumbersSubmitSchema = z.object({
  mode: dailyNumbersModeSchema,
  dateKey: z.string().min(1),
  questVersion: z.string().optional(),
  steps: z.array(dailyNumbersStepInputSchema),
});

export const speedQuestionSchema = z.object({
  index: z.number().int().nonnegative(),
  left: z.number().int(),
  right: z.number().int(),
  operator: z.enum(["+", "-"]),
});

export const speedRunHistoryEntrySchema = z.object({
  index: z.number().int().nonnegative(),
  left: z.number().int(),
  right: z.number().int(),
  operator: z.enum(["+", "-"]),
  userAnswer: z.number().int().nullable(),
  wasAnswered: z.boolean(),
  isCorrect: z.boolean(),
  correctAnswer: z.number().int().nullable(),
});

export const speedRunStateSchema = z.object({
  date: z.string(),
  questVersion: z.string().nullable().optional(),
  resetByName: z.string().nullable().optional(),
  runsUsed: z.number().int().nonnegative(),
  maxRuns: z.number().int().positive(),
  latestScore: z.number().int().nonnegative(),
  rewardPreview: z.number().int().nonnegative(),
  locked: z.boolean(),
  claimed: z.boolean(),
  completed: z.boolean(),
  canCashOut: z.boolean(),
  canStartRun: z.boolean(),
  rewardPerAnswer: z.number().int().positive(),
  runDurationSeconds: z.number().int().positive(),
  activeRun: z
    .object({
      runId: z.string(),
      runNumber: z.number().int().positive(),
      seed: z.string(),
      questionIndex: z.number().int().nonnegative(),
      questions: z.array(speedQuestionSchema),
      answers: z.array(z.number().int()),
      correctAnswers: z.number().int().nonnegative(),
      remainingSeconds: z.number().int().nonnegative(),
      pauseRemainingSeconds: z.number().int().nonnegative(),
      isManuallyPaused: z.boolean(),
      durationSeconds: z.number().int().positive(),
      pauseExpiresAt: z.string().nullable(),
      startedAt: z.string(),
    })
    .nullable(),
  history: z.array(
    z.object({
      runId: z.string(),
      runNumber: z.number().int().positive(),
      status: z.string(),
      score: z.number().int().nonnegative(),
      reward: z.number().int().nonnegative(),
      totalAnswered: z.number().int().nonnegative(),
      correctAnswers: z.number().int().nonnegative(),
      history: z.array(speedRunHistoryEntrySchema),
    }),
  ),
});

export const speedAnswerSchema = z.object({
  runId: z.string(),
  answer: z.number().int(),
  questVersion: z.string().optional(),
});

export const speedAnswerResponseSchema = z.object({
  questVersion: z.string().nullable().optional(),
  activeRun: z
    .object({
      runId: z.string(),
      runNumber: z.number().int().positive(),
      questionIndex: z.number().int().nonnegative(),
      correctAnswers: z.number().int().nonnegative(),
      remainingSeconds: z.number().int().nonnegative(),
      pauseRemainingSeconds: z.number().int().nonnegative(),
      isManuallyPaused: z.boolean(),
    })
    .nullable(),
});

export const speedTrainingRunSchema = z.object({
  runId: z.string(),
  seed: z.string(),
  questions: z.array(speedQuestionSchema),
  runDurationSeconds: z.number().int().positive(),
  pauseDurationSeconds: z.number().int().nonnegative(),
  rewardPerAnswer: z.number().int().positive(),
});

export const speedFinishSchema = z.object({
  runId: z.string(),
  questVersion: z.string().optional(),
});

export const pvpInviteSchema = z.object({
  inviteeEmail: z.string().email(),
  loadout: z.array(z.string()).length(6),
});

export const pvpLoadoutSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  name: z.string(),
  cardIds: z.array(z.string()).length(6),
  cards: z.array(cardSchema),
  invalidCardIds: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const pvpLoadoutsResponseSchema = z.object({
  loadouts: z.array(pvpLoadoutSchema),
});

export const pvpLoadoutMutationSchema = z.object({
  loadoutId: z.string().optional(),
  name: z.string().min(1),
  cardIds: z.array(z.string()).length(6),
});

export const pvpMatchSchema = z.object({
  id: z.string(),
  inviterId: z.string(),
  inviteeId: z.string(),
  inviterName: z.string().optional(),
  inviteeName: z.string().optional(),
  status: z.enum([
    "PENDING",
    "IN_PROGRESS",
    "COMPLETED",
    "DECLINED",
    "EXPIRED",
  ]),
  inviterLoadout: z.array(z.string()),
  inviteeLoadout: z.array(z.string()),
  winnerId: z.string().nullable(),
  currentTurn: z.number().int().positive().optional(),
  hasReplayData: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const pvpUnitStatusSchema = z.object({
  name: pvpStatusNameSchema,
  duration: z.number().int(),
  magnitude: z.number().optional().nullable(),
  appliedAt: z.number().int(),
});

export const pvpAbilityDefinitionSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.enum(["PASSIVE", "SKILL", "ULTIMATE"]),
  cost: z.number().int(),
  cooldown: z.number().int().nullable().optional(),
  oncePerMatch: z.boolean(),
  payload: pvpAbilityPayloadSchema.nullable().optional(),
});

export const pvpUnitStateSchema = z.object({
  instanceId: z.string(),
  cardId: z.string(),
  name: z.string(),
  character: z.string(),
  type: cardTypeSchema,
  rarity: rarityNameSchema,
  imageUrl: z.string().nullable().optional(),
  hp: z.number().int(),
  maxHp: z.number().int(),
  attack: z.number().int(),
  defense: z.number().int(),
  speed: z.number().int(),
  baseMaxHp: z.number().int().optional(),
  baseAttack: z.number().int().optional(),
  baseDefense: z.number().int().optional(),
  baseSpeed: z.number().int().optional(),
  statuses: z.array(pvpUnitStatusSchema),
  cooldowns: z.record(z.string(), z.number().int()),
  usedUltimate: z.boolean(),
  position: z.union([z.literal(1), z.literal(2), z.literal(3), z.null()]),
  skill: z.string().nullable().optional(),
  ultimate: z.string().nullable().optional(),
  passives: z.array(z.string()),
  knockedOut: z.boolean(),
});

export const pvpPlayerStateSchema = z.object({
  userId: z.string(),
  name: z.string(),
  energy: z.number().int(),
  units: z.array(pvpUnitStateSchema),
  bench: z.array(pvpUnitStateSchema),
});

export const pvpCombatEventSchema = z.object({
  seq: z.number().int(),
  turn: z.number().int().nonnegative(),
  type: pvpCombatEventTypeSchema,
  payload: z.record(z.string(), z.unknown()),
});

export const pvpBattleStateBaseSchema = z.object({
  id: z.string(),
  turn: z.number().int().positive(),
  phase: z.enum(["active", "ended"]),
  currentPlayerId: z.string(),
  winnerId: z.string().nullable().optional(),
  players: z.tuple([pvpPlayerStateSchema, pvpPlayerStateSchema]),
  log: z.array(pvpCombatEventSchema),
  abilityDefinitions: z
    .record(z.string(), pvpAbilityDefinitionSchema)
    .optional(),
});

export const pvpParticipantBattleStateSchema = pvpBattleStateBaseSchema.extend({
  isMyTurn: z.boolean(),
  myUserId: z.string(),
});

export const pvpSpectateBattleStateSchema = pvpBattleStateBaseSchema.extend({
  isMyTurn: z.literal(false),
  myUserId: z.null(),
});

export const pvpBattleStateSchema = pvpParticipantBattleStateSchema;

export const pvpMatchDetailResponseSchema = z.object({
  match: pvpMatchSchema,
  battleState: pvpParticipantBattleStateSchema.nullable(),
  replay: z
    .object({
      log: z.array(pvpCombatEventSchema),
      initialState: z.record(z.string(), z.unknown()),
      finalState: z.record(z.string(), z.unknown()).nullable().optional(),
      seed: z.string(),
      totalTurns: z.number().int().positive().nullable().optional(),
    })
    .nullable()
    .optional(),
});

export const pvpMatchMutationResponseSchema = z.object({
  match: pvpMatchSchema,
  battleState: pvpParticipantBattleStateSchema.nullable(),
  events: z.array(pvpCombatEventSchema).optional(),
});

export const pvpSpectateDetailResponseSchema = z.object({
  match: pvpMatchSchema,
  battleState: pvpSpectateBattleStateSchema.nullable(),
});

export const pvpActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("basic"),
    actorInstanceId: z.string(),
    targetInstanceId: z.string(),
  }),
  z.object({
    kind: z.literal("skill"),
    actorInstanceId: z.string(),
    abilityKey: z.string(),
    targetInstanceId: z.string().optional(),
  }),
  z.object({
    kind: z.literal("ultimate"),
    actorInstanceId: z.string(),
    abilityKey: z.string(),
    targetInstanceId: z.string().optional(),
  }),
  z.object({
    kind: z.literal("copy"),
    actorInstanceId: z.string(),
    abilityKey: z.string(),
    sourceInstanceId: z.string(),
    targetInstanceId: z.string().optional(),
  }),
  z.object({ kind: z.literal("pass") }),
]);

export const pvpEndTurnSchema = z.object({
  swap: z
    .object({ activeInstanceId: z.string(), benchInstanceId: z.string() })
    .optional(),
});

export const adminCardMutationSchema = z.object({
  isFeatured: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

export const pvpInvitesResponseSchema = z.object({
  invites: z.array(pvpMatchSchema),
});

export const pvpHistoryResponseSchema = z.object({
  matches: z.array(pvpMatchSchema),
  totalCount: z.number().int().nonnegative().optional(),
  currentUserId: z.string().optional(),
  stats: z
    .object({
      wins: z.number().int().nonnegative(),
      losses: z.number().int().nonnegative(),
      winRate: z.number().int().nonnegative(),
    })
    .optional(),
});

export const adminCardSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  character: z.string(),
  rarityName: z.string(),
  rarityId: z.string(),
  isArchived: z.boolean(),
  isFeatured: z.boolean(),
  description: z.string(),
  hp: z.number().int(),
  attack: z.number().int(),
  defense: z.number().int(),
  speed: z.number().int(),
  type: cardTypeSchema,
  imageAssetId: z.string().nullable(),
});

export const adminCardDetailSchema = adminCardSummarySchema;

export const adminCardsResponseSchema = z.object({
  cards: z.array(adminCardSummarySchema),
});

export const adminPackDetailSchema = adminPackSchema;

export const adminImageAssetSchema = z.object({
  id: z.string(),
  kind: z.literal("catalog"),
  mimeType: z.string(),
  previewUrl: z.string(),
  insertedAt: z.string(),
});

export const adminImageAssetsResponseSchema = z.object({
  imageAssets: z.array(adminImageAssetSchema),
});

export const adminCardBackVisualSchema = cardBackVisualSchema;

export const adminCardBackVisualsResponseSchema = z.object({
  cardBackVisuals: z.array(adminCardBackVisualSchema),
});

export const adminCardBackVisualEditSchema = z.object({
  themeName: z.enum(["candy", "ice", "nightosphere"]),
  rarityName: z.enum(["Common", "Uncommon", "Rare", "Epic", "Legendary"]),
  imageAssetId: z.string().nullable(),
});

export const adminCardEditSchema = z.object({
  name: z.string().min(1),
  character: z.string().min(1),
  description: z.string().min(1),
  hp: z.number().int().positive(),
  attack: z.number().int().positive(),
  defense: z.number().int().positive(),
  speed: z.number().int().positive(),
  type: cardTypeSchema,
  rarityId: z.string().min(1),
  isFeatured: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

export const adminAbilitySchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  description: z.string(),
  descriptionFr: z.string().nullable().optional(),
  nameFr: z.string().nullable().optional(),
  type: z.enum(["PASSIVE", "SKILL", "ULTIMATE"]),
  cost: z.number().int(),
  cooldown: z.number().int().nullable(),
  oncePerMatch: z.boolean(),
  payload: pvpAbilityPayloadSchema.nullable(),
});

export const adminCardAbilityAssignmentSchema = z.object({
  id: z.string(),
  cardId: z.string(),
  passiveId: z.string().nullable(),
  skillId: z.string().nullable(),
  ultimateId: z.string().nullable(),
});

export const adminAbilitiesResponseSchema = z.object({
  abilities: z.array(adminAbilitySchema),
  cardAbilities: z.array(adminCardAbilityAssignmentSchema),
  cards: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      character: z.string(),
      type: z.string(),
    }),
  ),
});

export const adminAbilityEditSchema = z.object({
  id: z.string().optional(),
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  descriptionFr: z.string().optional().nullable(),
  nameFr: z.string().optional().nullable(),
  type: z.enum(["PASSIVE", "SKILL", "ULTIMATE"]),
  cost: z.number().int(),
  cooldown: z.number().int().nullable().optional(),
  oncePerMatch: z.boolean().optional(),
  payload: pvpAbilityPayloadSchema.nullable().optional(),
});

export const adminCardAbilityAssignSchema = z.object({
  cardId: z.string().min(1),
  passiveId: z.string().nullable().optional(),
  skillId: z.string().nullable().optional(),
  ultimateId: z.string().nullable().optional(),
});

export const featuredCardsResponseSchema = z.object({
  cards: collectionResponseSchema.shape.cards,
});

export type FeaturedCardsResponse = z.infer<typeof featuredCardsResponseSchema>;

export const homeResponseSchema = z.object({
  user: authUserSchema,
  collectionStats: collectionStatsSchema,
});

export const authResponseSchema = z.object({
  user: authUserSchema,
  tokens: authTokensSchema,
});

export const registerResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  authorized: z.boolean(),
  accessRequestPending: z.boolean(),
  devCode: z.string().optional(),
});

export const verifyEmailResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  authorized: z.boolean(),
  accessRequestPending: z.boolean(),
  devCode: z.string().optional(),
});

export const requestPasswordResetResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  devCode: z.string().optional(),
});

export const resetPasswordResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const stepSummarySchema = z.object({
  source: stepSourceSchema,
  stepCount: z.number().int().nonnegative(),
  recordedFor: z.string(),
  updatedAt: z.string(),
});

export const healthStepsResponseSchema = z.object({
  preferredSource: stepSourceSchema,
  latest: stepSummarySchema.nullable(),
});

export const syncStepsSchema = z.object({
  source: stepSourceSchema,
  stepCount: z.number().int().nonnegative(),
  recordedFor: z.string().min(1),
});

export const updateStepSourceSchema = z.object({
  preferredStepSource: stepSourceSchema,
});

export const updateLanguageSchema = z.object({
  preferredLanguage: localeSchema,
});

export const updateTimezoneSchema = z.object({
  timezone: z.string().min(1),
});

export const updateNotificationPreferencesSchema = z.object({
  notificationPreferences: notificationPreferencesSchema,
});

export const notificationPlatformSchema = z.enum(["ios", "android"]);

export const registerNotificationDeviceSchema = z.object({
  installationId: z.string().min(1).max(128),
  platform: notificationPlatformSchema,
  expoPushToken: z.string().min(1).max(512),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type RegisterResponse = z.infer<typeof registerResponseSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type VerifyEmailResponse = z.infer<typeof verifyEmailResponseSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;
export type RequestPasswordResetResponse = z.infer<
  typeof requestPasswordResetResponseSchema
>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ResetPasswordResponse = z.infer<typeof resetPasswordResponseSchema>;
export type CollectionResponse = z.infer<typeof collectionResponseSchema>;
export type UsersResponse = z.infer<typeof usersResponseSchema>;
export type HomeResponse = z.infer<typeof homeResponseSchema>;
export type PacksResponse = z.infer<typeof packsResponseSchema>;
export type CardBackVisual = z.infer<typeof cardBackVisualSchema>;
export type AdminPacksResponse = z.infer<typeof adminPacksResponseSchema>;
export type AdminPackDetail = z.infer<typeof adminPackDetailSchema>;
export type AdminImageAssetsResponse = z.infer<
  typeof adminImageAssetsResponseSchema
>;
export type AdminImageAsset = z.infer<typeof adminImageAssetSchema>;
export type AdminCardBackVisualsResponse = z.infer<
  typeof adminCardBackVisualsResponseSchema
>;
export type AdminCardBackVisual = z.infer<typeof adminCardBackVisualSchema>;
export type AdminCardBackVisualEditInput = z.infer<
  typeof adminCardBackVisualEditSchema
>;
export type OpenPackInput = z.infer<typeof openPackSchema>;
export type OpenPackResponse = z.infer<typeof openPackResponseSchema>;
export type DailyClaimStatus = z.infer<typeof dailyClaimStatusSchema>;
export type DailyClaimResponse = z.infer<typeof dailyClaimResponseSchema>;
export type DailyClaimConflict = z.infer<typeof dailyClaimConflictSchema>;
export type QuestsResponse = z.infer<typeof questsResponseSchema>;
export type FitbitStatusResponse = z.infer<typeof fitbitStatusResponseSchema>;
export type FitbitAuthorizeInput = z.infer<typeof fitbitAuthorizeSchema>;
export type FitbitAuthorizeResponse = z.infer<
  typeof fitbitAuthorizeResponseSchema
>;
export type FitbitDisconnectResponse = z.infer<
  typeof fitbitDisconnectResponseSchema
>;
export type ClaimQuestInput = z.infer<typeof claimQuestSchema>;
export type ClaimQuestResponse = z.infer<typeof claimQuestResponseSchema>;
export type WordleStateResponse = z.infer<typeof wordleStateResponseSchema>;
export type DailyNumbersMode = z.infer<typeof dailyNumbersModeSchema>;
export type DailyNumbersTile = z.infer<typeof dailyNumbersTileSchema>;
export type DailyNumbersStepInput = z.infer<typeof dailyNumbersStepInputSchema>;
export type DailyNumbersStep = z.infer<typeof dailyNumbersStepSchema>;
export type DailyNumbersSubmission = z.infer<typeof dailyNumbersSubmissionSchema>;
export type DailyNumbersStateResponse = z.infer<
  typeof dailyNumbersStateResponseSchema
>;
export type DailyNumbersSubmitInput = z.infer<typeof dailyNumbersSubmitSchema>;
export type WordleDefinitionVariant = z.infer<
  typeof wordleDefinitionVariantSchema
>;
export type WordleDefinitionResponse = z.infer<
  typeof wordleDefinitionResponseSchema
>;
export type WordleLocale = z.infer<typeof wordleLocaleSchema>;
export type WordleSubmitInput = z.infer<typeof wordleSubmitSchema>;
export type WordleSubmitResponse = z.infer<typeof wordleSubmitResponseSchema>;
export type SpeedRunState = z.infer<typeof speedRunStateSchema>;
export type SpeedRunAnswerResponse = z.infer<typeof speedAnswerResponseSchema>;
export type SpeedTrainingRun = z.infer<typeof speedTrainingRunSchema>;
export type SpeedRunHistoryEntry = z.infer<typeof speedRunHistoryEntrySchema>;
export type PvpAction = z.infer<typeof pvpActionSchema>;
export type PvpEndTurnInput = z.infer<typeof pvpEndTurnSchema>;
export type PvpBattleStateBase = z.infer<typeof pvpBattleStateBaseSchema>;
export type PvpParticipantBattleState = z.infer<
  typeof pvpParticipantBattleStateSchema
>;
export type PvpSpectateBattleState = z.infer<
  typeof pvpSpectateBattleStateSchema
>;
export type PvpBattleState = PvpParticipantBattleState;
export type PvpUnitState = z.infer<typeof pvpUnitStateSchema>;
export type PvpPlayerState = z.infer<typeof pvpPlayerStateSchema>;
export type PvpMatch = z.infer<typeof pvpMatchSchema>;
export type PvpMatchDetailResponse = z.infer<
  typeof pvpMatchDetailResponseSchema
>;
export type PvpSpectateDetailResponse = z.infer<
  typeof pvpSpectateDetailResponseSchema
>;
export type PvpLoadoutsResponse = z.infer<typeof pvpLoadoutsResponseSchema>;
export type AdminCardsResponse = z.infer<typeof adminCardsResponseSchema>;
export type AdminCardDetail = z.infer<typeof adminCardDetailSchema>;
export type AdminPackEditInput = z.infer<typeof adminPackEditSchema>;
export type AdminAbilitiesResponse = z.infer<
  typeof adminAbilitiesResponseSchema
>;
export type GiftsResponse = z.infer<typeof giftsResponseSchema>;
export type StepSummary = z.infer<typeof stepSummarySchema>;
export type HealthStepsResponse = z.infer<typeof healthStepsResponseSchema>;
export type SyncStepsInput = z.infer<typeof syncStepsSchema>;
export type UpdateStepSourceInput = z.infer<typeof updateStepSourceSchema>;
export type UpdateLanguageInput = z.infer<typeof updateLanguageSchema>;
export type UpdateTimezoneInput = z.infer<typeof updateTimezoneSchema>;
export type UpdateNotificationPreferencesInput = z.infer<
  typeof updateNotificationPreferencesSchema
>;
export type RegisterNotificationDeviceInput = z.infer<
  typeof registerNotificationDeviceSchema
>;

export const updateDisplayNameSchema = z.object({
  displayName: z.string().min(1).max(64),
});

export const raritiesResponseSchema = z.object({
  rarities: z.array(
    raritySchema.extend({
      dustValue: z.number().int().nonnegative().optional(),
      craftCost: z.number().int().nonnegative().optional(),
    }),
  ),
});

export const adminUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  coins: z.number().int().nonnegative(),
  isAdmin: z.boolean(),
  isSuperAdmin: z.boolean(),
  createdAt: z.string(),
});

export const adminUsersResponseSchema = z.object({
  users: z.array(adminUserSchema),
});

export const adminCoinAdjustSchema = z.object({
  delta: z.number().int(),
});

export const adminUserRoleUpdateSchema = z.object({
  isAdmin: z.boolean().optional(),
  role: z.enum(["user", "admin", "super_admin"]).optional(),
});

export const adminUserQuestResetInputSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("all"),
  }),
  z.object({
    mode: z.literal("single"),
    questType: z.string().min(1),
  }),
]);

export const adminUserDailyQuestSchema = questSchema;

export const adminUserDetailSchema = adminUserSchema.extend({
  todayDate: z.string(),
  dailyQuests: z.array(adminUserDailyQuestSchema),
  viewerPermissions: z.object({
    canManageCoins: z.boolean(),
    canManageAdminRights: z.boolean(),
    canResetDailyQuests: z.boolean(),
    canDeleteUser: z.boolean(),
  }),
});

export const adminUserDeleteResponseSchema = z.object({
  success: z.boolean(),
  deletedUserId: z.string(),
});

export const adminUserQuestResetResponseSchema = z.object({
  success: z.boolean(),
  resetDate: z.string(),
  resetMode: z.enum(["all", "single"]),
  questType: z.string().nullable(),
});

export const adminAllowedEmailSchema = z.object({
  email: z.string().email(),
  isAdmin: z.boolean().optional(),
  isSuperAdmin: z.boolean().optional(),
});

export const adminAllowedEmailUpdateSchema = z.object({
  isAdmin: z.boolean().optional(),
  isSuperAdmin: z.boolean().optional(),
});

export const adminEmailRequestActionSchema = z.object({
  status: z.enum(["approved", "rejected"]),
});

export const allowedEmailSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  isAdmin: z.boolean(),
  isSuperAdmin: z.boolean(),
  createdAt: z.string(),
});

export const allowedEmailsResponseSchema = z.object({
  emails: z.array(allowedEmailSchema),
});

export const emailAccessRequestSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  status: z.enum(["pending", "approved", "rejected"]),
  hasAccount: z.boolean(),
  createdAt: z.string(),
});

export const emailAccessRequestsResponseSchema = z.object({
  requests: z.array(emailAccessRequestSchema),
});

export const pvpSpectateMatchSchema = z.object({
  id: z.string(),
  inviterId: z.string(),
  inviteeId: z.string(),
  inviterName: z.string().nullable().optional(),
  inviteeName: z.string().nullable().optional(),
  status: z
    .enum(["PENDING", "IN_PROGRESS", "COMPLETED", "DECLINED", "EXPIRED"])
    .optional(),
  currentTurn: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

export const pvpSpectateResponseSchema = z.object({
  matches: z.array(pvpSpectateMatchSchema),
});

export type UpdateDisplayNameInput = z.infer<typeof updateDisplayNameSchema>;
export type RaritiesResponse = z.infer<typeof raritiesResponseSchema>;
export type AdminUser = z.infer<typeof adminUserSchema>;
export type AdminUsersResponse = z.infer<typeof adminUsersResponseSchema>;
export type AdminCoinAdjustInput = z.infer<typeof adminCoinAdjustSchema>;
export type AdminUserRoleUpdateInput = z.infer<
  typeof adminUserRoleUpdateSchema
>;
export type AdminUserQuestResetInput = z.infer<
  typeof adminUserQuestResetInputSchema
>;
export type AdminUserDetail = z.infer<typeof adminUserDetailSchema>;
export type AdminUserDeleteResponse = z.infer<
  typeof adminUserDeleteResponseSchema
>;
export type AdminUserQuestResetResponse = z.infer<
  typeof adminUserQuestResetResponseSchema
>;
export type AllowedEmailsResponse = z.infer<typeof allowedEmailsResponseSchema>;
export type EmailAccessRequestsResponse = z.infer<
  typeof emailAccessRequestsResponseSchema
>;
export type PvpSpectateResponse = z.infer<typeof pvpSpectateResponseSchema>;
