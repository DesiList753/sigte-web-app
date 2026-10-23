UPDATE "User" SET "organizationId" = 'org_usm_vina'
WHERE "organizationId" IS NULL AND "role" <> 'SUPER_ADMIN'
  AND EXISTS (SELECT 1 FROM "Organization" WHERE "id" = 'org_usm_vina');

UPDATE "Vehicle" v SET "organizationId" = u."organizationId"
FROM "User" u
WHERE v."organizationId" IS NULL AND u."id" = v."ownerId" AND u."organizationId" IS NOT NULL;

UPDATE "AccessLog" a SET "organizationId" = v."organizationId"
FROM "Vehicle" v
WHERE a."organizationId" IS NULL AND v."id" = a."vehicleId";

UPDATE "Infraction" i SET "organizationId" = v."organizationId"
FROM "Vehicle" v
WHERE i."organizationId" IS NULL AND v."id" = i."vehicleId";

UPDATE "Notification" n SET "organizationId" = u."organizationId"
FROM "User" u
WHERE n."organizationId" IS NULL AND u."id" = n."userId";

UPDATE "ParkingBlock" SET "organizationId" = 'org_usm_vina'
WHERE "organizationId" IS NULL
  AND EXISTS (SELECT 1 FROM "Organization" WHERE "id" = 'org_usm_vina');

ALTER TABLE "Vehicle" DROP CONSTRAINT "Vehicle_organizationId_fkey";

ALTER TABLE "ParkingBlock" DROP CONSTRAINT "ParkingBlock_organizationId_fkey";

ALTER TABLE "AccessLog" DROP CONSTRAINT "AccessLog_organizationId_fkey";

ALTER TABLE "Infraction" DROP CONSTRAINT "Infraction_organizationId_fkey";

ALTER TABLE "Notification" DROP CONSTRAINT "Notification_organizationId_fkey";

DROP INDEX "User_universityId_key";

DROP INDEX "User_rut_key";

DROP INDEX "Vehicle_plate_key";

DROP INDEX "AccessLog_timestamp_idx";

ALTER TABLE "Vehicle" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "ParkingBlock" DROP COLUMN "isDefault",
ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "AccessLog" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "Infraction" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "Notification" ALTER COLUMN "organizationId" SET NOT NULL;

CREATE UNIQUE INDEX "User_organizationId_universityId_key" ON "User"("organizationId", "universityId");

CREATE UNIQUE INDEX "User_organizationId_rut_key" ON "User"("organizationId", "rut");

CREATE UNIQUE INDEX "Vehicle_organizationId_plate_key" ON "Vehicle"("organizationId", "plate");

ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ParkingBlock" ADD CONSTRAINT "ParkingBlock_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AccessLog" ADD CONSTRAINT "AccessLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Infraction" ADD CONSTRAINT "Infraction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "User" ADD CONSTRAINT "User_role_organization_check" CHECK (("role" = 'SUPER_ADMIN') = ("organizationId" IS NULL));
