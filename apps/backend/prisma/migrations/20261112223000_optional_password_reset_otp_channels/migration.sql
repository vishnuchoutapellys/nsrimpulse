ALTER TABLE "PasswordResetChallenge"
  ALTER COLUMN "emailOtpHash" DROP NOT NULL,
  ALTER COLUMN "mobileOtpHash" DROP NOT NULL;
