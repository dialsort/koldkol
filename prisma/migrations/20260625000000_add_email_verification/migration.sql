-- Add email verification fields to User
-- emailVerified defaults to TRUE for all existing rows (seed + any existing users)
ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT true;
-- New rows created by the app must explicitly be set to false until verified
ALTER TABLE "User" ALTER COLUMN "emailVerified" SET DEFAULT false;

ALTER TABLE "User" ADD COLUMN "verificationToken" TEXT;
ALTER TABLE "User" ADD COLUMN "verificationTokenExpiry" TIMESTAMP(3);
ALTER TABLE "User" ADD CONSTRAINT "User_verificationToken_key" UNIQUE ("verificationToken");
