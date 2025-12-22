-- Step 1: Add new columns as nullable
ALTER TABLE "AttendanceSession" 
ADD COLUMN "actualStartAt" TIMESTAMP(3),
ADD COLUMN "actualEndAt" TIMESTAMP(3),
ADD COLUMN "effectiveStartAt" TIMESTAMP(3),
ADD COLUMN "effectiveEndAt" TIMESTAMP(3),
ADD COLUMN "wasEarlyCheckIn" BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Copy data from old columns to new columns
UPDATE "AttendanceSession" 
SET 
  "actualStartAt" = "startedAt",
  "effectiveStartAt" = "startedAt",
  "actualEndAt" = "endedAt",
  "effectiveEndAt" = "endedAt";

-- Step 3: Make required columns NOT NULL
ALTER TABLE "AttendanceSession" 
ALTER COLUMN "actualStartAt" SET NOT NULL,
ALTER COLUMN "effectiveStartAt" SET NOT NULL;

-- Step 4: Drop old columns
ALTER TABLE "AttendanceSession" 
DROP COLUMN "startedAt",
DROP COLUMN "endedAt";
