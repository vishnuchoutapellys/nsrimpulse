CREATE TYPE "AdminAccountStatus" AS ENUM ('ACTIVE', 'HOLD', 'BLOCKED');

ALTER TABLE "User"
ADD COLUMN "accountStatus" "AdminAccountStatus" NOT NULL DEFAULT 'ACTIVE';

UPDATE "User"
SET "accountStatus" = 'BLOCKED'
WHERE "isActive" = false;
