-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('GENERAL', 'CCA', 'PUBLIC_HOLIDAY', 'HOLIDAY_OVERRIDE');
CREATE TYPE "EventTargetType" AS ENUM ('USER', 'ROLE', 'GROUP', 'ALL');
CREATE TYPE "GroupType" AS ENUM ('PLC', 'KAH', 'PATROL', 'CUSTOM');

-- Add category to Event
ALTER TABLE "Event" ADD COLUMN "category" "EventCategory" NOT NULL DEFAULT 'GENERAL';

-- CreateTable
CREATE TABLE "Group" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "type" "GroupType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserGroup" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventTarget" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "eventId" UUID NOT NULL,
    "type" "EventTargetType" NOT NULL,
    "userId" UUID,
    "role" "Role",
    "groupId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventTarget_pkey" PRIMARY KEY ("id")
);

-- Migrate assigneeId to EventTarget
INSERT INTO "EventTarget" ("id", "eventId", "type", "userId", "createdAt")
SELECT gen_random_uuid(), "id", 'USER', "assigneeId", CURRENT_TIMESTAMP
FROM "Event"
WHERE "assigneeId" IS NOT NULL;

-- Drop old index/constraint/column
DROP INDEX IF EXISTS "Event_assigneeId_startsAt_status_idx";
ALTER TABLE "Event" DROP CONSTRAINT IF EXISTS "Event_assigneeId_fkey";
ALTER TABLE "Event" DROP COLUMN "assigneeId";

-- Indexes
CREATE INDEX "Event_startsAt_status_idx" ON "Event"("startsAt", "status");
CREATE INDEX "Group_type_name_idx" ON "Group"("type", "name");
CREATE UNIQUE INDEX "UserGroup_userId_groupId_key" ON "UserGroup"("userId", "groupId");
CREATE INDEX "UserGroup_userId_idx" ON "UserGroup"("userId");
CREATE INDEX "UserGroup_groupId_idx" ON "UserGroup"("groupId");
CREATE UNIQUE INDEX "EventTarget_eventId_type_userId_role_groupId_key" ON "EventTarget"("eventId", "type", "userId", "role", "groupId");
CREATE INDEX "EventTarget_eventId_idx" ON "EventTarget"("eventId");
CREATE INDEX "EventTarget_type_userId_idx" ON "EventTarget"("type", "userId");
CREATE INDEX "EventTarget_type_role_idx" ON "EventTarget"("type", "role");
CREATE INDEX "EventTarget_type_groupId_idx" ON "EventTarget"("type", "groupId");

-- Foreign Keys
ALTER TABLE "UserGroup" ADD CONSTRAINT "UserGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserGroup" ADD CONSTRAINT "UserGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventTarget" ADD CONSTRAINT "EventTarget_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventTarget" ADD CONSTRAINT "EventTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventTarget" ADD CONSTRAINT "EventTarget_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
