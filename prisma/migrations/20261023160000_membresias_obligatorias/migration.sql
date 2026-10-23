ALTER TABLE "User" ADD COLUMN "lastOrganizationId" TEXT,
ADD COLUMN "platformAdmin" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User" SET "platformAdmin" = true WHERE "role" = 'SUPER_ADMIN';

UPDATE "User" SET "lastOrganizationId" = "organizationId" WHERE "organizationId" IS NOT NULL;

INSERT INTO "Membership" ("id", "userId", "organizationId", "role", "active", "credentialId", "userType", "position", "department", "academicDepartment", "career", "createdAt", "updatedAt")
SELECT 'mbr_' || u."id", u."id", u."organizationId", u."role", u."active", u."credentialId", u."userType", u."position", u."department", u."academicDepartment", u."career", u."createdAt", CURRENT_TIMESTAMP
FROM "User" u
WHERE u."organizationId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Membership" m WHERE m."userId" = u."id" AND m."organizationId" = u."organizationId");

ALTER TABLE "User" DROP CONSTRAINT "User_role_organization_check";

ALTER TABLE "User" DROP CONSTRAINT "User_organizationId_fkey";

DROP INDEX "User_organizationId_credentialId_key";

DROP INDEX "User_organizationId_role_idx";

DROP INDEX "User_organizationId_rut_key";

ALTER TABLE "User" DROP COLUMN "academicDepartment",
DROP COLUMN "active",
DROP COLUMN "career",
DROP COLUMN "credentialId",
DROP COLUMN "department",
DROP COLUMN "organizationId",
DROP COLUMN "position",
DROP COLUMN "role",
DROP COLUMN "userType";

CREATE UNIQUE INDEX "User_rut_key" ON "User"("rut");
