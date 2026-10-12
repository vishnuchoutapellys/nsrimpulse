ALTER TABLE "StudentAccount"
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lockedUntil" TIMESTAMP(3),
ADD COLUMN "passwordChangedAt" TIMESTAMP(3),
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "PasswordResetChallenge" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "emailOtpHash" TEXT NOT NULL,
    "mobileOtpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attemptsRemaining" INTEGER NOT NULL DEFAULT 5,
    "emailVerifiedAt" TIMESTAMP(3),
    "mobileVerifiedAt" TIMESTAMP(3),
    "resetTokenHash" TEXT,
    "resetTokenExpiresAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PasswordResetChallenge_accountId_createdAt_idx" ON "PasswordResetChallenge"("accountId", "createdAt");
CREATE INDEX "PasswordResetChallenge_expiresAt_idx" ON "PasswordResetChallenge"("expiresAt");

ALTER TABLE "PasswordResetChallenge"
ADD CONSTRAINT "PasswordResetChallenge_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "StudentAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;