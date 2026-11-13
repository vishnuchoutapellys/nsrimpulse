CREATE TYPE "PocketMoneyWithdrawalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "Student"
ADD COLUMN "pocketMoneyBalance" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "FeeAssignment"
ADD COLUMN "bookFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "dhobiFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "pocketMoneyAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "fixedDeposit" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "FeeAssignment" ALTER COLUMN "feeStructureId" DROP NOT NULL;

CREATE TABLE "PocketMoneyWithdrawal" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "requestedAmount" DECIMAL(12,2) NOT NULL,
  "approvedAmount" DECIMAL(12,2),
  "remark" TEXT NOT NULL,
  "status" "PocketMoneyWithdrawalStatus" NOT NULL DEFAULT 'PENDING',
  "transactionNumber" TEXT,
  "receiptNumber" TEXT,
  "reviewedBy" TEXT,
  "reviewerNote" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  CONSTRAINT "PocketMoneyWithdrawal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PocketMoneyWithdrawal_transactionNumber_key" ON "PocketMoneyWithdrawal"("transactionNumber");
CREATE UNIQUE INDEX "PocketMoneyWithdrawal_receiptNumber_key" ON "PocketMoneyWithdrawal"("receiptNumber");
CREATE INDEX "PocketMoneyWithdrawal_studentId_status_requestedAt_idx" ON "PocketMoneyWithdrawal"("studentId", "status", "requestedAt");
ALTER TABLE "PocketMoneyWithdrawal" ADD CONSTRAINT "PocketMoneyWithdrawal_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
