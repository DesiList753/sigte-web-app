CREATE TYPE "JoinPolicy" AS ENUM ('OPEN', 'APPROVAL', 'INVITE_ONLY');

CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED');

CREATE TYPE "VehicleStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "Organization" ADD COLUMN "joinPolicy" "JoinPolicy" NOT NULL DEFAULT 'APPROVAL',
ADD COLUMN "vehicleApproval" BOOLEAN NOT NULL DEFAULT true;

UPDATE "Organization"
SET "joinPolicy" = CASE WHEN "selfRegistration" THEN 'OPEN'::"JoinPolicy" ELSE 'INVITE_ONLY'::"JoinPolicy" END,
    "vehicleApproval" = false;

ALTER TABLE "Organization" DROP COLUMN "selfRegistration";

ALTER TABLE "Membership" ADD COLUMN "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "Vehicle" ADD COLUMN "status" "VehicleStatus" NOT NULL DEFAULT 'APPROVED';

CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

CREATE UNIQUE INDEX "Invitation_organizationId_email_key" ON "Invitation"("organizationId", "email");

CREATE INDEX "Membership_organizationId_status_idx" ON "Membership"("organizationId", "status");

CREATE INDEX "Vehicle_organizationId_status_idx" ON "Vehicle"("organizationId", "status");

ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
