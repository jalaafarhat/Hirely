-- AlterTable: replace Stripe columns with PayMe
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "payme_subscription_id" TEXT;

ALTER TABLE "users" DROP COLUMN IF EXISTS "stripe_customer_id";
ALTER TABLE "users" DROP COLUMN IF EXISTS "stripe_subscription_id";
