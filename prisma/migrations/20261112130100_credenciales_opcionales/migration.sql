ALTER TABLE "Organization" ADD COLUMN "credentialsEnabled" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Plan"
SET "features" = array_append("features", 'CREDENTIALS'::"PlanFeature"), "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'organizacional' AND NOT ('CREDENTIALS'::"PlanFeature" = ANY ("features"));

UPDATE "Organization" o
SET "credentialsEnabled" = true
WHERE EXISTS (
  SELECT 1 FROM "Membership" m WHERE m."organizationId" = o."id" AND m."credentialId" IS NOT NULL
);
