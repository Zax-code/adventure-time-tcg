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
export type StepSummary = z.infer<typeof stepSummarySchema>;
export type HealthStepsResponse = z.infer<typeof healthStepsResponseSchema>;
export type SyncStepsInput = z.infer<typeof syncStepsSchema>;
export type UpdateStepSourceInput = z.infer<typeof updateStepSourceSchema>;
