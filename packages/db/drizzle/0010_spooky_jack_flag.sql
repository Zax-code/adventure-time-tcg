ALTER TABLE "allowed_emails" ADD COLUMN "is_super_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_quests" ADD COLUMN "reset_by_user_id" text;