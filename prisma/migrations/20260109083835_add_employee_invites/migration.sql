-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "EmployeeInvite" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "invitedEmail" TEXT NOT NULL,
    "invitedName" TEXT,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "tokenHash" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "EmployeeInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeInvite_companyId_idx" ON "EmployeeInvite"("companyId");

-- CreateIndex
CREATE INDEX "EmployeeInvite_invitedEmail_idx" ON "EmployeeInvite"("invitedEmail");

-- CreateIndex
CREATE INDEX "EmployeeInvite_status_idx" ON "EmployeeInvite"("status");

-- CreateIndex
CREATE INDEX "EmployeeInvite_tokenExpiresAt_idx" ON "EmployeeInvite"("tokenExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeInvite_companyId_invitedEmail_status_key" ON "EmployeeInvite"("companyId", "invitedEmail", "status");

-- AddForeignKey
ALTER TABLE "EmployeeInvite" ADD CONSTRAINT "EmployeeInvite_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeInvite" ADD CONSTRAINT "EmployeeInvite_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
