import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const stepSourceEnum = pgEnum("step_source", [
  "device_health",
  "fitbit",
]);
export const localeEnum = pgEnum("locale", ["en", "fr"]);
export const imageKindEnum = pgEnum("image_kind", ["card", "profile"]);
export const pvpMatchStatusEnum = pgEnum("pvp_match_status", [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "DECLINED",
]);
export const emailAccessRequestStatusEnum = pgEnum(
  "email_access_request_status",
  ["pending", "approved", "rejected"],
);

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name"),
    coins: integer("coins").default(100).notNull(),
    dust: integer("dust").default(0).notNull(),
    preferredLanguage: localeEnum("preferred_language").default("en").notNull(),
    timezone: text("timezone").default("Europe/Paris").notNull(),
    lastDailyClaim: timestamp("last_daily_claim", {
      withTimezone: true,
      mode: "date",
    }),
    avatarAssetId: text("avatar_asset_id"),
    isAdmin: boolean("is_admin").default(false).notNull(),
    preferredStepSource: stepSourceEnum("preferred_step_source")
      .default("device_health")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("users_email_key").on(table.email)],
);

export const emailAuthCredentials = pgTable(
  "email_auth_credentials",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("email_auth_credentials_user_id_key").on(table.userId),
  ],
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    refreshTokenHash: text("refresh_token_hash").notNull(),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("auth_sessions_user_id_idx").on(table.userId)],
);

export const rarities = pgTable(
  "rarities",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    dropRate: real("drop_rate").notNull(),
    color: text("color").notNull(),
  },
  (table) => [uniqueIndex("rarities_name_key").on(table.name)],
);

export const imageAssets = pgTable(
  "image_assets",
  {
    id: text("id").primaryKey(),
    kind: imageKindEnum("kind").notNull(),
    mimeType: text("mime_type").notNull(),
    objectKey: text("object_key"),
    placeholderSvg: text("placeholder_svg"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("image_assets_kind_idx").on(table.kind)],
);

export const cards = pgTable("cards", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  character: text("character").notNull(),
  description: text("description").notNull(),
  hp: integer("hp").notNull(),
  attack: integer("attack").notNull(),
  defense: integer("defense").notNull(),
  speed: integer("speed").default(40).notNull(),
  type: text("type").notNull(),
  rarityId: text("rarity_id")
    .notNull()
    .references(() => rarities.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
  imageAssetId: text("image_asset_id").references(() => imageAssets.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  isFeatured: boolean("is_featured").default(false).notNull(),
  isArchived: boolean("is_archived").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
});

export const packs = pgTable(
  "packs",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    cardCount: integer("card_count").default(5).notNull(),
    cost: integer("cost").default(100).notNull(),
    imageUrl: text("image_url").notNull(),
    color: text("color").default("#EC4899").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    guaranteedRarity: text("guaranteed_rarity"),
  },
  (table) => [uniqueIndex("packs_name_key").on(table.name)],
);

export const questDefinitions = pgTable(
  "quest_definitions",
  {
    id: text("id").primaryKey(),
    questType: text("quest_type").notNull(),
    titleKey: text("title_key").notNull(),
    descriptionKey: text("description_key").notNull(),
    icon: text("icon").notNull(),
    target: integer("target").notNull(),
    reward: integer("reward").notNull(),
    requiresFitbit: boolean("requires_fitbit").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("quest_definitions_quest_type_key").on(table.questType),
  ],
);

export const dailyQuests = pgTable(
  "daily_quests",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    date: text("date").notNull(),
    questType: text("quest_type").notNull(),
    target: integer("target").notNull(),
    reward: integer("reward").notNull(),
    progress: integer("progress").default(0).notNull(),
    completed: boolean("completed").default(false).notNull(),
    claimed: boolean("claimed").default(false).notNull(),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "date",
    }),
    claimedAt: timestamp("claimed_at", { withTimezone: true, mode: "date" }),
    resetByUserId: text("reset_by_user_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("daily_quests_user_id_idx").on(table.userId),
    uniqueIndex("daily_quests_user_date_type_key").on(
      table.userId,
      table.date,
      table.questType,
    ),
  ],
);

export const wordleDailyWords = pgTable(
  "wordle_daily_words",
  {
    id: text("id").primaryKey(),
    date: text("date").notNull(),
    word: text("word").notNull(),
    source: text("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("wordle_daily_words_date_key").on(table.date)],
);

export const wordleDictionaryWords = pgTable(
  "wordle_dictionary_words",
  {
    id: text("id").primaryKey(),
    locale: text("locale").notNull(),
    word: text("word").notNull(),
    length: integer("length").notNull(),
    isAllowedGuess: boolean("is_allowed_guess").default(true).notNull(),
    isSolutionCandidate: boolean("is_solution_candidate")
      .default(true)
      .notNull(),
  },
  (table) => [
    uniqueIndex("wordle_dictionary_locale_word_key").on(
      table.locale,
      table.word,
    ),
  ],
);

export const wordleDailyAttempts = pgTable(
  "wordle_daily_attempts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    date: text("date").notNull(),
    attempt: integer("attempt").notNull(),
    guess: text("guess").notNull(),
    evaluation: text("evaluation").notNull(),
    solved: boolean("solved").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("wordle_attempts_user_date_attempt_key").on(
      table.userId,
      table.date,
      table.attempt,
    ),
  ],
);

export const speedCalculusDailyRuns = pgTable(
  "speed_calculus_daily_runs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    date: text("date").notNull(),
    runNumber: integer("run_number").notNull(),
    seed: text("seed").notNull(),
    answers: text("answers").default("[]").notNull(),
    status: text("status").default("in_progress").notNull(),
    score: integer("score").default(0).notNull(),
    reward: integer("reward").default(0).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true, mode: "date" }),
    pauseExpiresAt: timestamp("pause_expires_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    uniqueIndex("speed_runs_user_date_run_key").on(
      table.userId,
      table.date,
      table.runNumber,
    ),
  ],
);

export const pvpMatches = pgTable(
  "pvp_matches",
  {
    id: text("id").primaryKey(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    inviteeId: text("invitee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    status: pvpMatchStatusEnum("status").default("PENDING").notNull(),
    inviterLoadout: text("inviter_loadout").default("[]").notNull(),
    inviteeLoadout: text("invitee_loadout").default("[]").notNull(),
    winnerId: text("winner_id").references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    seed: text("seed"),
    state: text("state"),
    initialState: text("initial_state"),
    replayVersion: integer("replay_version"),
    turnSnapshots: text("turn_snapshots"),
    matchLog: text("match_log").default("[]").notNull(),
    currentTurn: integer("current_turn").default(1).notNull(),
    turnStartedAt: timestamp("turn_started_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("pvp_matches_inviter_id_idx").on(table.inviterId),
    index("pvp_matches_invitee_id_idx").on(table.inviteeId),
    index("pvp_matches_status_idx").on(table.status),
  ],
);

export const abilityDefs = pgTable(
  "ability_defs",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    descriptionFr: text("description_fr"),
    nameFr: text("name_fr"),
    type: text("type").notNull(),
    cost: integer("cost").default(0).notNull(),
    cooldown: integer("cooldown"),
    oncePerMatch: boolean("once_per_match").default(false).notNull(),
    payload: text("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("ability_defs_key_key").on(table.key)],
);

export const cardAbilities = pgTable(
  "card_abilities",
  {
    id: text("id").primaryKey(),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    passiveId: text("passive_id").references(() => abilityDefs.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    skillId: text("skill_id").references(() => abilityDefs.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    ultimateId: text("ultimate_id").references(() => abilityDefs.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("card_abilities_card_id_key").on(table.cardId),
    index("card_abilities_card_id_idx").on(table.cardId),
  ],
);

export const pvpLoadouts = pgTable(
  "pvp_loadouts",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    name: text("name").notNull(),
    cardIds: text("card_ids").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("pvp_loadouts_owner_id_idx").on(table.ownerId)],
);

export const cardGifts = pgTable(
  "card_gifts",
  {
    id: text("id").primaryKey(),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade", onUpdate: "cascade" }),
    fromUserId: text("from_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    toUserId: text("to_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    quantity: integer("quantity").default(1).notNull(),
    message: text("message"),
    status: text("status").default("pending").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("card_gifts_from_user_id_idx").on(table.fromUserId),
    index("card_gifts_to_user_id_idx").on(table.toUserId),
    index("card_gifts_status_idx").on(table.status),
  ],
);

export const ownedCards = pgTable(
  "owned_cards",
  {
    id: text("id").primaryKey(),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade", onUpdate: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    quantity: integer("quantity").notNull(),
    obtainedAt: timestamp("obtained_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (table) => [
    uniqueIndex("owned_cards_card_id_user_id_key").on(
      table.cardId,
      table.userId,
    ),
  ],
);

export const userStepSnapshots = pgTable(
  "user_step_snapshots",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    source: stepSourceEnum("source").notNull(),
    stepCount: integer("step_count").notNull(),
    recordedFor: text("recorded_for").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("user_step_snapshots_user_id_idx").on(table.userId),
    uniqueIndex("user_step_snapshots_user_source_day_key").on(
      table.userId,
      table.source,
      table.recordedFor,
    ),
  ],
);

export const allowedEmails = pgTable(
  "allowed_emails",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    isAdmin: boolean("is_admin").default(false).notNull(),
    isSuperAdmin: boolean("is_super_admin").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("allowed_emails_email_key").on(table.email)],
);

export const emailAccessRequests = pgTable(
  "email_access_requests",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    status: emailAccessRequestStatusEnum("status").default("pending").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("email_access_requests_status_idx").on(table.status),
    uniqueIndex("email_access_requests_email_key").on(table.email),
  ],
);

export const usersRelations = relations(users, ({ many, one }) => ({
  credential: one(emailAuthCredentials, {
    fields: [users.id],
    references: [emailAuthCredentials.userId],
  }),
  ownedCards: many(ownedCards),
  pvpLoadouts: many(pvpLoadouts),
  sentGifts: many(cardGifts, { relationName: "gift_sender" }),
  receivedGifts: many(cardGifts, { relationName: "gift_recipient" }),
  stepSnapshots: many(userStepSnapshots),
  avatarAsset: one(imageAssets, {
    fields: [users.avatarAssetId],
    references: [imageAssets.id],
  }),
}));

export const cardsRelations = relations(cards, ({ one, many }) => ({
  rarity: one(rarities, {
    fields: [cards.rarityId],
    references: [rarities.id],
  }),
  imageAsset: one(imageAssets, {
    fields: [cards.imageAssetId],
    references: [imageAssets.id],
  }),
  ownedCards: many(ownedCards),
  gifts: many(cardGifts),
  abilities: one(cardAbilities, {
    fields: [cards.id],
    references: [cardAbilities.cardId],
  }),
}));

export const ownedCardsRelations = relations(ownedCards, ({ one }) => ({
  user: one(users, {
    fields: [ownedCards.userId],
    references: [users.id],
  }),
  card: one(cards, {
    fields: [ownedCards.cardId],
    references: [cards.id],
  }),
}));

export const userStepSnapshotsRelations = relations(
  userStepSnapshots,
  ({ one }) => ({
    user: one(users, {
      fields: [userStepSnapshots.userId],
      references: [users.id],
    }),
  }),
);

export const pvpLoadoutsRelations = relations(pvpLoadouts, ({ one }) => ({
  owner: one(users, {
    fields: [pvpLoadouts.ownerId],
    references: [users.id],
  }),
}));

export const abilityDefsRelations = relations(abilityDefs, ({ many }) => ({
  passiveAssignments: many(cardAbilities, { relationName: "passive_ability" }),
  skillAssignments: many(cardAbilities, { relationName: "skill_ability" }),
  ultimateAssignments: many(cardAbilities, {
    relationName: "ultimate_ability",
  }),
}));

export const cardAbilitiesRelations = relations(cardAbilities, ({ one }) => ({
  card: one(cards, {
    fields: [cardAbilities.cardId],
    references: [cards.id],
  }),
  passive: one(abilityDefs, {
    fields: [cardAbilities.passiveId],
    references: [abilityDefs.id],
    relationName: "passive_ability",
  }),
  skill: one(abilityDefs, {
    fields: [cardAbilities.skillId],
    references: [abilityDefs.id],
    relationName: "skill_ability",
  }),
  ultimate: one(abilityDefs, {
    fields: [cardAbilities.ultimateId],
    references: [abilityDefs.id],
    relationName: "ultimate_ability",
  }),
}));

export const cardGiftsRelations = relations(cardGifts, ({ one }) => ({
  card: one(cards, {
    fields: [cardGifts.cardId],
    references: [cards.id],
  }),
  fromUser: one(users, {
    fields: [cardGifts.fromUserId],
    references: [users.id],
    relationName: "gift_sender",
  }),
  toUser: one(users, {
    fields: [cardGifts.toUserId],
    references: [users.id],
    relationName: "gift_recipient",
  }),
}));

export const emailAuthCredentialsRelations = relations(
  emailAuthCredentials,
  ({ one }) => ({
    user: one(users, {
      fields: [emailAuthCredentials.userId],
      references: [users.id],
    }),
  }),
);
