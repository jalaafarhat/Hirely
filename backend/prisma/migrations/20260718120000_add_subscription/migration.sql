-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('NONE', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "subscription_status" "SubscriptionStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "users" ADD COLUMN "subscription_expires_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "stripe_customer_id" TEXT;
ALTER TABLE "users" ADD COLUMN "stripe_subscription_id" TEXT;
