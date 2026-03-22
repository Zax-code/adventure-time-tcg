import { z } from "zod";

export { translations, type Locale } from "./i18n/translations";

export const stepSourceSchema = z.enum(["device_health", "fitbit"]);
export const localeSchema = z.enum(["en", "fr"]);

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
});

export type AuthUser = z.infer<typeof authUserSchema>;

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
});

export const googleAuthSchema = z
  .object({
    idToken: z.string().min(1).optional(),
    accessToken: z.string().min(1).optional(),
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
  type: z.string(),
  rarity: raritySchema,
  imageAssetId: z.string().nullable(),
  abilities: cardAbilitiesSchema.nullable().optional(),
});

export const collectionEntrySchema = z.object({
  id: z.string(),
  cardId: z.string(),
  quantity: z.number().int().nonnegative(),
  obtainedAt: z.string(),
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
  imageUrl: z.string(),
  color: z.string(),
  isActive: z.boolean(),
  guaranteedRarity: z.string().nullable(),
});

export const packsResponseSchema = z.object({
  packs: z.array(packSchema),
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
});

export const questsResponseSchema = z.object({
  quests: z.array(questSchema),
  fitbitConnected: z.boolean(),
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
export const wordleGuessSchema = z.object({
  guess: z.string(),
  evaluation: z.array(wordleLetterStateSchema),
});

export const wordleStateResponseSchema = z.object({
  date: z.string(),
  resetTimezone: z.string(),
  guesses: z.array(wordleGuessSchema),
  solved: z.boolean(),
  targetWord: z.string().optional(),
  questVersion: z.string().nullable().optional(),
  resetByName: z.string().nullable().optional(),
});

export const wordleSubmitSchema = z.object({
  guess: z.string().min(1),
  expectedDate: z.string().optional(),
});

export const wordleSubmitResponseSchema = z.object({
  evaluation: z.array(wordleLetterStateSchema),
  solved: z.boolean(),
  date: z.string(),
  questJustCompleted: z.boolean(),
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
});

export const speedFinishSchema = z.object({
  runId: z.string(),
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
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "DECLINED"]),
  inviterLoadout: z.array(z.string()),
  inviteeLoadout: z.array(z.string()),
  winnerId: z.string().nullable(),
  currentTurn: z.number().int().positive().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const pvpUnitStatusSchema = z.object({
  name: z.string(),
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
  cooldown: z.number().int().optional(),
  oncePerMatch: z.boolean(),
});

export const pvpUnitStateSchema = z.object({
  instanceId: z.string(),
  cardId: z.string(),
  name: z.string(),
  character: z.string(),
  type: z.string(),
  rarity: z.string(),
  imageUrl: z.string(),
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
  skill: z.string(),
  ultimate: z.string(),
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

export const pvpBattleStateSchema = z.object({
  id: z.string(),
  turn: z.number().int().positive(),
  phase: z.enum(["active", "ended"]),
  currentPlayerId: z.string(),
  isMyTurn: z.boolean(),
  myUserId: z.string(),
  winnerId: z.string().nullable().optional(),
  players: z.tuple([pvpPlayerStateSchema, pvpPlayerStateSchema]),
  log: z.array(
    z.object({
      seq: z.number().int(),
      turn: z.number().int().nonnegative(),
      type: z.string(),
      payload: z.record(z.string(), z.unknown()),
    }),
  ),
  abilityDefinitions: z.record(z.string(), pvpAbilityDefinitionSchema).optional(),
});

export const pvpMatchDetailResponseSchema = z.object({
  match: pvpMatchSchema,
  battleState: pvpBattleStateSchema.nullable(),
});

export const pvpActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("basic"), actorInstanceId: z.string(), targetInstanceId: z.string() }),
  z.object({ kind: z.literal("skill"), actorInstanceId: z.string(), abilityKey: z.string(), targetInstanceId: z.string().optional() }),
  z.object({ kind: z.literal("ultimate"), actorInstanceId: z.string(), abilityKey: z.string(), targetInstanceId: z.string().optional() }),
  z.object({ kind: z.literal("copy"), actorInstanceId: z.string(), abilityKey: z.string(), sourceInstanceId: z.string(), targetInstanceId: z.string().optional() }),
  z.object({ kind: z.literal("pass") }),
]);

export const pvpEndTurnSchema = z.object({
  swap: z.object({ activeInstanceId: z.string(), benchInstanceId: z.string() }).optional(),
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
  type: z.string(),
  imageAssetId: z.string().nullable(),
});

export const adminCardDetailSchema = adminCardSummarySchema;

export const adminCardsResponseSchema = z.object({
  cards: z.array(adminCardSummarySchema),
});

export const adminCardEditSchema = z.object({
  name: z.string().min(1),
  character: z.string().min(1),
  description: z.string().min(1),
  hp: z.number().int().positive(),
  attack: z.number().int().positive(),
  defense: z.number().int().positive(),
  speed: z.number().int().positive(),
  type: z.string().min(1),
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
  payload: z.any(),
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
  payload: z.any().optional(),
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

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type CollectionResponse = z.infer<typeof collectionResponseSchema>;
export type UsersResponse = z.infer<typeof usersResponseSchema>;
export type HomeResponse = z.infer<typeof homeResponseSchema>;
export type PacksResponse = z.infer<typeof packsResponseSchema>;
export type OpenPackInput = z.infer<typeof openPackSchema>;
export type OpenPackResponse = z.infer<typeof openPackResponseSchema>;
export type DailyClaimStatus = z.infer<typeof dailyClaimStatusSchema>;
export type DailyClaimResponse = z.infer<typeof dailyClaimResponseSchema>;
export type DailyClaimConflict = z.infer<typeof dailyClaimConflictSchema>;
export type QuestsResponse = z.infer<typeof questsResponseSchema>;
export type ClaimQuestInput = z.infer<typeof claimQuestSchema>;
export type ClaimQuestResponse = z.infer<typeof claimQuestResponseSchema>;
export type WordleStateResponse = z.infer<typeof wordleStateResponseSchema>;
export type WordleSubmitInput = z.infer<typeof wordleSubmitSchema>;
export type WordleSubmitResponse = z.infer<typeof wordleSubmitResponseSchema>;
export type SpeedRunState = z.infer<typeof speedRunStateSchema>;
export type SpeedRunHistoryEntry = z.infer<typeof speedRunHistoryEntrySchema>;
export type PvpAction = z.infer<typeof pvpActionSchema>;
export type PvpEndTurnInput = z.infer<typeof pvpEndTurnSchema>;
export type PvpBattleState = z.infer<typeof pvpBattleStateSchema>;
export type PvpUnitState = z.infer<typeof pvpUnitStateSchema>;
export type PvpPlayerState = z.infer<typeof pvpPlayerStateSchema>;
export type PvpMatch = z.infer<typeof pvpMatchSchema>;
export type PvpMatchDetailResponse = z.infer<
  typeof pvpMatchDetailResponseSchema
>;
export type PvpLoadoutsResponse = z.infer<typeof pvpLoadoutsResponseSchema>;
export type AdminCardsResponse = z.infer<typeof adminCardsResponseSchema>;
export type AdminCardDetail = z.infer<typeof adminCardDetailSchema>;
export type AdminAbilitiesResponse = z.infer<
  typeof adminAbilitiesResponseSchema
>;
export type GiftsResponse = z.infer<typeof giftsResponseSchema>;
export type StepSummary = z.infer<typeof stepSummarySchema>;
export type HealthStepsResponse = z.infer<typeof healthStepsResponseSchema>;
export type SyncStepsInput = z.infer<typeof syncStepsSchema>;
export type UpdateStepSourceInput = z.infer<typeof updateStepSourceSchema>;
export type UpdateLanguageInput = z.infer<typeof updateLanguageSchema>;

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
  isAdmin: z.boolean(),
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
  currentTurn: z.number().int().positive(),
  createdAt: z.string(),
});

export const pvpSpectateResponseSchema = z.object({
  matches: z.array(pvpSpectateMatchSchema),
});

export type UpdateDisplayNameInput = z.infer<typeof updateDisplayNameSchema>;
export type RaritiesResponse = z.infer<typeof raritiesResponseSchema>;
export type AdminUser = z.infer<typeof adminUserSchema>;
export type AdminUsersResponse = z.infer<typeof adminUsersResponseSchema>;
export type AdminCoinAdjustInput = z.infer<typeof adminCoinAdjustSchema>;
export type AdminUserRoleUpdateInput = z.infer<typeof adminUserRoleUpdateSchema>;
export type AdminUserQuestResetInput = z.infer<typeof adminUserQuestResetInputSchema>;
export type AdminUserDetail = z.infer<typeof adminUserDetailSchema>;
export type AdminUserDeleteResponse = z.infer<typeof adminUserDeleteResponseSchema>;
export type AdminUserQuestResetResponse = z.infer<typeof adminUserQuestResetResponseSchema>;
export type AllowedEmailsResponse = z.infer<typeof allowedEmailsResponseSchema>;
export type EmailAccessRequestsResponse = z.infer<
  typeof emailAccessRequestsResponseSchema
>;
export type PvpSpectateResponse = z.infer<typeof pvpSpectateResponseSchema>;
