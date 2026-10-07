/*
  Warnings:

  - A unique constraint covering the columns `[adminId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adminId" TEXT;

-- CreateTable
CREATE TABLE "CollegeAdminScope" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "branchId" TEXT,

    CONSTRAINT "CollegeAdminScope_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CollegeAdminScope_collegeId_branchId_idx" ON "CollegeAdminScope"("collegeId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "CollegeAdminScope_userId_collegeId_branchId_key" ON "CollegeAdminScope"("userId", "collegeId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "User_adminId_key" ON "User"("adminId");

-- AddForeignKey
ALTER TABLE "CollegeAdminScope" ADD CONSTRAINT "CollegeAdminScope_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollegeAdminScope" ADD CONSTRAINT "CollegeAdminScope_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollegeAdminScope" ADD CONSTRAINT "CollegeAdminScope_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
