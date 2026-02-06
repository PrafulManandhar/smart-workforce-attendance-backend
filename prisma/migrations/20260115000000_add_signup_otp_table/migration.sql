-- CreateTable
CREATE TABLE "SignupOtp" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignupOtp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SignupOtp_email_key" ON "SignupOtp"("email");

-- CreateIndex
CREATE INDEX "SignupOtp_email_idx" ON "SignupOtp"("email");

-- CreateIndex
CREATE INDEX "SignupOtp_expiresAt_idx" ON "SignupOtp"("expiresAt");
