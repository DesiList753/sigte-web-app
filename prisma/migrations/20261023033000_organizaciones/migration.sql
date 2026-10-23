ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';

CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

CREATE TYPE "RegistrationForm" AS ENUM ('BASIC', 'ACADEMIC');

CREATE TYPE "PlanFeature" AS ENUM ('INFRACTIONS', 'REPORTS', 'QR');

CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'ROLE_CHANGE', 'RESOLVE', 'PLAN_CHANGE', 'SUSPEND', 'REACTIVATE');

CREATE TYPE "AuditEntity" AS ENUM ('ORGANIZATION', 'USER', 'VEHICLE', 'PARKING_BLOCK', 'INFRACTION');

CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxUsers" INTEGER,
    "maxGuards" INTEGER,
    "maxBlocks" INTEGER,
    "maxVehicles" INTEGER,
    "features" "PlanFeature"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "logoUrl" TEXT,
    "brandColor" TEXT,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "planId" TEXT NOT NULL,
    "registrationForm" "RegistrationForm" NOT NULL DEFAULT 'BASIC',
    "selfRegistration" BOOLEAN NOT NULL DEFAULT true,
    "allowedEmailDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defaultBlockId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entity" "AuditEntity" NOT NULL,
    "entityId" TEXT,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "User" ADD COLUMN "organizationId" TEXT;

ALTER TABLE "Vehicle" ADD COLUMN "organizationId" TEXT;

ALTER TABLE "ParkingBlock" ADD COLUMN "organizationId" TEXT;

ALTER TABLE "AccessLog" ADD COLUMN "organizationId" TEXT;

ALTER TABLE "Infraction" ADD COLUMN "organizationId" TEXT;

ALTER TABLE "Notification" ADD COLUMN "organizationId" TEXT;

INSERT INTO "Plan" ("id", "code", "name", "maxUsers", "maxGuards", "maxBlocks", "maxVehicles", "features", "updatedAt") VALUES
    ('plan_basico', 'basico', 'Básico', 100, 2, 3, 150, ARRAY['QR']::"PlanFeature"[], CURRENT_TIMESTAMP),
    ('plan_profesional', 'profesional', 'Profesional', 1000, 10, 10, 1500, ARRAY['QR', 'INFRACTIONS']::"PlanFeature"[], CURRENT_TIMESTAMP),
    ('plan_institucional', 'institucional', 'Institucional', NULL, NULL, NULL, NULL, ARRAY['QR', 'INFRACTIONS', 'REPORTS']::"PlanFeature"[], CURRENT_TIMESTAMP);

INSERT INTO "Organization" ("id", "slug", "name", "displayName", "logoUrl", "brandColor", "planId", "registrationForm", "updatedAt")
SELECT 'org_usm_vina', 'usm-vina', 'Universidad Técnica Federico Santa María, Sede Viña del Mar', 'USM Sede Viña del Mar', '/escudo-usm.png', '#004B85', 'plan_institucional', 'ACADEMIC', CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "User") OR EXISTS (SELECT 1 FROM "Vehicle") OR EXISTS (SELECT 1 FROM "ParkingBlock");

UPDATE "User" SET "organizationId" = 'org_usm_vina';

UPDATE "Vehicle" SET "organizationId" = 'org_usm_vina';

UPDATE "ParkingBlock" SET "organizationId" = 'org_usm_vina';

UPDATE "AccessLog" SET "organizationId" = 'org_usm_vina';

UPDATE "Infraction" SET "organizationId" = 'org_usm_vina';

UPDATE "Notification" SET "organizationId" = 'org_usm_vina';

UPDATE "ParkingBlock" SET "isDefault" = true
WHERE "name" = 'No definido' AND NOT EXISTS (SELECT 1 FROM "ParkingBlock" WHERE "isDefault");

INSERT INTO "ParkingBlock" ("id", "organizationId", "name", "description", "capacity", "isDefault", "updatedAt")
SELECT 'blk_usm_no_definido', 'org_usm_vina', 'No definido', 'Bloque por defecto — asignar luego', 200, true, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "Organization" WHERE "id" = 'org_usm_vina')
  AND NOT EXISTS (SELECT 1 FROM "ParkingBlock" WHERE "isDefault");

UPDATE "Organization"
SET "defaultBlockId" = (
    SELECT "id" FROM "ParkingBlock"
    WHERE "isDefault" AND "organizationId" = 'org_usm_vina'
    ORDER BY "createdAt", "id"
    LIMIT 1
)
WHERE "id" = 'org_usm_vina';

UPDATE "ParkingBlock" SET "isDefault" = false
WHERE "isDefault" AND "id" <> (SELECT "defaultBlockId" FROM "Organization" WHERE "id" = 'org_usm_vina');

DROP INDEX "ParkingBlock_name_key";

CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

CREATE UNIQUE INDEX "Organization_defaultBlockId_key" ON "Organization"("defaultBlockId");

CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

CREATE INDEX "User_organizationId_role_idx" ON "User"("organizationId", "role");

CREATE UNIQUE INDEX "ParkingBlock_organizationId_name_key" ON "ParkingBlock"("organizationId", "name");

CREATE INDEX "AccessLog_organizationId_timestamp_idx" ON "AccessLog"("organizationId", "timestamp");

CREATE INDEX "Infraction_organizationId_status_idx" ON "Infraction"("organizationId", "status");

ALTER TABLE "Organization" ADD CONSTRAINT "Organization_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Organization" ADD CONSTRAINT "Organization_defaultBlockId_fkey" FOREIGN KEY ("defaultBlockId") REFERENCES "ParkingBlock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ParkingBlock" ADD CONSTRAINT "ParkingBlock_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AccessLog" ADD CONSTRAINT "AccessLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Infraction" ADD CONSTRAINT "Infraction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
