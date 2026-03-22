ALTER TABLE "allowed_emails" ADD COLUMN "is_super_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "allowed_emails"
SET "is_admin" = true, "is_super_admin" = true
WHERE "email" = 'boomslang.a@gmail.com';--> statement-breakpoint
INSERT INTO "allowed_emails" ("id", "email", "is_admin", "is_super_admin")
SELECT 'boomslang-a-gmail-com-super-admin', 'boomslang.a@gmail.com', true, true
WHERE NOT EXISTS (
  SELECT 1
  FROM "allowed_emails"
  WHERE "email" = 'boomslang.a@gmail.com'
);
