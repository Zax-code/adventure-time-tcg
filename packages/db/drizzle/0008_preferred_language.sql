CREATE TYPE "public"."locale" AS ENUM('en', 'fr');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "preferred_language" "locale" DEFAULT 'en' NOT NULL;
