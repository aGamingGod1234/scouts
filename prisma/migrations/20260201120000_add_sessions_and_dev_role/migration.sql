-- Add DEV role
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'DEV';

-- Add lastLoginAt to User
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);

-- Create Session table
CREATE TABLE "Session" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "ipHash" TEXT,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- Foreign Keys
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
