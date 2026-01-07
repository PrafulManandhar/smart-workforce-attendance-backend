-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "status" "ShiftStatus" NOT NULL DEFAULT 'PUBLISHED';
