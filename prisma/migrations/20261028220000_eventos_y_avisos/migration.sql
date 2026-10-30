-- CreateEnum
CREATE TYPE "EventKind" AS ENUM ('EVENT', 'EMERGENCY', 'MAINTENANCE', 'NOTICE');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('ACTIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventAudience" AS ENUM ('ALL', 'USERS', 'GUARDS', 'AFFECTED_VEHICLES');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('SYSTEM', 'EVENT', 'EMERGENCY', 'MAINTENANCE', 'NOTICE');

-- AlterEnum
ALTER TYPE "AuditEntity" ADD VALUE 'EVENT';

-- AlterTable
ALTER TABLE "ParkingBlock" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "eventId" TEXT,
ADD COLUMN "kind" "NotificationKind" NOT NULL DEFAULT 'SYSTEM';

-- CreateTable
CREATE TABLE "ParkingEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "kind" "EventKind" NOT NULL DEFAULT 'EVENT',
    "status" "EventStatus" NOT NULL DEFAULT 'ACTIVE',
    "disableEntry" BOOLEAN NOT NULL DEFAULT true,
    "showBanner" BOOLEAN NOT NULL DEFAULT true,
    "audience" "EventAudience" NOT NULL DEFAULT 'ALL',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParkingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParkingEventBlock" (
    "eventId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,

    CONSTRAINT "ParkingEventBlock_pkey" PRIMARY KEY ("eventId","blockId")
);

-- CreateIndex
CREATE INDEX "ParkingEvent_organizationId_status_startsAt_idx" ON "ParkingEvent"("organizationId", "status", "startsAt");

-- CreateIndex
CREATE INDEX "ParkingEventBlock_blockId_idx" ON "ParkingEventBlock"("blockId");

-- CreateIndex
CREATE INDEX "Notification_organizationId_userId_createdAt_idx" ON "Notification"("organizationId", "userId", "createdAt");

-- AddForeignKey
ALTER TABLE "ParkingEvent" ADD CONSTRAINT "ParkingEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingEvent" ADD CONSTRAINT "ParkingEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingEventBlock" ADD CONSTRAINT "ParkingEventBlock_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ParkingEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingEventBlock" ADD CONSTRAINT "ParkingEventBlock_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "ParkingBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ParkingEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
