/*
  Warnings:

  - You are about to drop the column `resetPasswordExpiry` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `resetPasswordToken` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('DRAFT', 'ACTIVE_TRIAL', 'ACTIVE_PAID', 'SUSPENDED');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "currentRosteringMethod" TEXT,
ADD COLUMN     "employeeLimit" INTEGER,
ADD COLUMN     "estimatedEmployeeRange" TEXT,
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "status" "CompanyStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "trialEndAt" TIMESTAMP(3),
ADD COLUMN     "trialStartAt" TIMESTAMP(3),
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "code" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "resetPasswordExpiry",
DROP COLUMN "resetPasswordToken",
ADD COLUMN     "resetPasswordExpiresAt" TIMESTAMP(3),
ADD COLUMN     "resetPasswordTokenHash" TEXT;
