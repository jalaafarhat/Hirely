-- AlterTable
ALTER TABLE "user_preferences" ADD COLUMN     "digest_hours" INTEGER[] DEFAULT ARRAY[9, 15]::INTEGER[],
ADD COLUMN     "email_digest_enabled" BOOLEAN NOT NULL DEFAULT true;
