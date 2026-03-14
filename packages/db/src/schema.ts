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

export const stepSourceEnum = pgEnum("step_source", ["device_health", "fitbit"]);
export const imageKindEnum = pgEnum("image_kind", ["card", "profile"]);

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name"),
    coins: integer("coins").default(100).notNull(),
    dust: integer("dust").default(0).notNull(),
    avatarAssetId: text("avatar_asset_id"),
    isAdmin: boolean("is_admin").default(false).notNull(),
    preferredStepSource: stepSourceEnum("preferred_step_source").default("device_health").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("users_email_key").on(table.email)],
);

export const emailAuthCredentials = pgTable(
  "email_auth_credentials",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("email_auth_credentials_user_id_key").on(table.userId)],
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    refreshTokenHash: text("refresh_token_hash").notNull(),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
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
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
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
  rarityId: text("rarity_id").notNull().references(() => rarities.id, { onDelete: "restrict", onUpdate: "cascade" }),
  imageAssetId: text("image_asset_id").references(() => imageAssets.id, { onDelete: "set null", onUpdate: "cascade" }),
  isArchived: boolean("is_archived").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
});

export const ownedCards = pgTable(
  "owned_cards",
  {
    id: text("id").primaryKey(),
    cardId: text("card_id").notNull().references(() => cards.id, { onDelete: "cascade", onUpdate: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    quantity: integer("quantity").notNull(),
    obtainedAt: timestamp("obtained_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [uniqueIndex("owned_cards_card_id_user_id_key").on(table.cardId, table.userId)],
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

export const usersRelations = relations(users, ({ many, one }) => ({
  credential: one(emailAuthCredentials, {
    fields: [users.id],
    references: [emailAuthCredentials.userId],
  }),
  ownedCards: many(ownedCards),
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

export const userStepSnapshotsRelations = relations(userStepSnapshots, ({ one }) => ({
  user: one(users, {
    fields: [userStepSnapshots.userId],
    references: [users.id],
  }),
}));

export const emailAuthCredentialsRelations = relations(emailAuthCredentials, ({ one }) => ({
  user: one(users, {
    fields: [emailAuthCredentials.userId],
    references: [users.id],
  }),
}));
