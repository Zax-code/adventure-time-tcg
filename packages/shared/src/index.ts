import { z } from "zod";

export const stepSourceSchema = z.enum(["device_health", "fitbit"]);

export const authUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  avatarAssetId: z.string().nullable(),
  coins: z.number().int().nonnegative(),
  dust: z.number().int().nonnegative(),
  isAdmin: z.boolean(),
  preferredStepSource: stepSourceSchema,
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

export const raritySchema = z.object({
  id: z.string(),
  name: z.string(),
  dropRate: z.number(),
  color: z.string(),
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

export const speedRunStateSchema = z.object({
  date: z.string(),
  runsUsed: z.number().int().nonnegative(),
  maxRuns: z.number().int().positive(),
  latestScore: z.number().int().nonnegative(),
  rewardPreview: z.number().int().nonnegative(),
  locked: z.boolean(),
  activeRun: z.object({
    runId: z.string(),
    runNumber: z.number().int().positive(),
    seed: z.string(),
    questionIndex: z.number().int().nonnegative(),
    questions: z.array(speedQuestionSchema),
    answers: z.array(z.number().int()),
    pauseExpiresAt: z.string().nullable(),
    startedAt: z.string(),
  }).nullable(),
  history: z.array(z.object({
    runId: z.string(),
    runNumber: z.number().int().positive(),
    status: z.string(),
    score: z.number().int().nonnegative(),
    reward: z.number().int().nonnegative(),
  })),
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

export const pvpMatchSchema = z.object({
  id: z.string(),
  inviterId: z.string(),
  inviteeId: z.string(),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "DECLINED"]),
  inviterLoadout: z.array(z.string()),
  inviteeLoadout: z.array(z.string()),
  winnerId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
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
  isArchived: z.boolean(),
  isFeatured: z.boolean(),
});

export const adminCardsResponseSchema = z.object({
  cards: z.array(adminCardSummarySchema),
});

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

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type CollectionResponse = z.infer<typeof collectionResponseSchema>;
export type HomeResponse = z.infer<typeof homeResponseSchema>;
export type PacksResponse = z.infer<typeof packsResponseSchema>;
export type OpenPackInput = z.infer<typeof openPackSchema>;
export type OpenPackResponse = z.infer<typeof openPackResponseSchema>;
export type DailyClaimStatus = z.infer<typeof dailyClaimStatusSchema>;
export type DailyClaimResponse = z.infer<typeof dailyClaimResponseSchema>;
export type QuestsResponse = z.infer<typeof questsResponseSchema>;
export type ClaimQuestInput = z.infer<typeof claimQuestSchema>;
export type ClaimQuestResponse = z.infer<typeof claimQuestResponseSchema>;
export type WordleStateResponse = z.infer<typeof wordleStateResponseSchema>;
export type WordleSubmitInput = z.infer<typeof wordleSubmitSchema>;
export type WordleSubmitResponse = z.infer<typeof wordleSubmitResponseSchema>;
export type SpeedRunState = z.infer<typeof speedRunStateSchema>;
export type PvpMatch = z.infer<typeof pvpMatchSchema>;
export type AdminCardsResponse = z.infer<typeof adminCardsResponseSchema>;
export type StepSummary = z.infer<typeof stepSummarySchema>;
export type HealthStepsResponse = z.infer<typeof healthStepsResponseSchema>;
export type SyncStepsInput = z.infer<typeof syncStepsSchema>;
export type UpdateStepSourceInput = z.infer<typeof updateStepSourceSchema>;
