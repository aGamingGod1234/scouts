-- Migration: add_notification_type_deeplink
-- Created: 2026-01-31

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('TASK', 'EVENT', 'ANNOUNCEMENT', 'MEET', 'MESSAGE', 'SYSTEM');

-- AlterTable: Add new columns to Notification
ALTER TABLE "Notification" ADD COLUMN "type" "NotificationType" NOT NULL DEFAULT 'SYSTEM';
ALTER TABLE "Notification" ADD COLUMN "deeplink" TEXT;

-- DropIndex: Remove old index
DROP INDEX IF EXISTS "Notification_userId_createdAt_idx";

-- CreateIndex: New composite index including status for efficient filtering
CREATE INDEX "Notification_userId_status_createdAt_idx" ON "Notification"("userId", "status", "createdAt");
