-- AlterTable
ALTER TABLE "AttendanceSession" ADD COLUMN     "summary" TEXT;

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "paidBreakMinutes" INTEGER DEFAULT 0,
ADD COLUMN     "unpaidBreakMinutes" INTEGER DEFAULT 0;
