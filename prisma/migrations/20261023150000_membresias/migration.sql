CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "credentialId" TEXT,
    "userType" "UserType",
    "position" TEXT,
    "department" TEXT,
    "academicDepartment" TEXT,
    "career" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Membership_role_check" CHECK ("role" <> 'SUPER_ADMIN')
);

CREATE INDEX "Membership_organizationId_role_idx" ON "Membership"("organizationId", "role");

CREATE UNIQUE INDEX "Membership_userId_organizationId_key" ON "Membership"("userId", "organizationId");

CREATE UNIQUE INDEX "Membership_organizationId_credentialId_key" ON "Membership"("organizationId", "credentialId");

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Membership" ("id", "userId", "organizationId", "role", "active", "credentialId", "userType", "position", "department", "academicDepartment", "career", "createdAt", "updatedAt")
SELECT 'mbr_' || "id", "id", "organizationId", "role", "active", "credentialId", "userType", "position", "department", "academicDepartment", "career", "createdAt", CURRENT_TIMESTAMP
FROM "User"
WHERE "organizationId" IS NOT NULL;
