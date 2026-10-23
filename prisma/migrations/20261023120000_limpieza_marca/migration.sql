DROP TABLE "PushToken";

ALTER TABLE "User" RENAME COLUMN "universityId" TO "credentialId";

ALTER INDEX "User_organizationId_universityId_key" RENAME TO "User_organizationId_credentialId_key";
