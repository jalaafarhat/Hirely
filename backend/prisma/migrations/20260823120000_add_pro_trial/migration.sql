-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "trial_expires_at" TIMESTAMP(3);

-- Grant 24h trial to existing users without an active subscription
UPDATE "users"
SET "trial_expires_at" = NOW() + INTERVAL '24 hours'
WHERE "subscription_status" = 'NONE'
  AND "trial_expires_at" IS NULL
  AND LOWER("email") <> 'jalaa.c.m@gmail.com';
