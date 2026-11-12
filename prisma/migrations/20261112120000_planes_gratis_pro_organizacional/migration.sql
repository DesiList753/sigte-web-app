UPDATE "Plan"
SET "code" = 'gratis', "name" = 'Gratis', "maxUsers" = NULL, "maxGuards" = 1, "maxBlocks" = 2, "maxVehicles" = 30,
    "features" = ARRAY['QR']::"PlanFeature"[], "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'basico';

UPDATE "Plan"
SET "code" = 'pro', "name" = 'Pro', "maxUsers" = NULL, "maxGuards" = 10, "maxBlocks" = 10, "maxVehicles" = 500,
    "features" = ARRAY['QR', 'INFRACTIONS']::"PlanFeature"[], "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'profesional';

UPDATE "Plan"
SET "code" = 'organizacional', "name" = 'Organizacional', "maxUsers" = NULL, "maxGuards" = NULL, "maxBlocks" = NULL, "maxVehicles" = NULL,
    "features" = ARRAY['QR', 'INFRACTIONS', 'REPORTS']::"PlanFeature"[], "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'institucional';

INSERT INTO "Plan" ("id", "code", "name", "maxUsers", "maxGuards", "maxBlocks", "maxVehicles", "features", "updatedAt")
VALUES
  ('plan_gratis', 'gratis', 'Gratis', NULL, 1, 2, 30, ARRAY['QR']::"PlanFeature"[], CURRENT_TIMESTAMP),
  ('plan_pro', 'pro', 'Pro', NULL, 10, 10, 500, ARRAY['QR', 'INFRACTIONS']::"PlanFeature"[], CURRENT_TIMESTAMP),
  ('plan_organizacional', 'organizacional', 'Organizacional', NULL, NULL, NULL, NULL, ARRAY['QR', 'INFRACTIONS', 'REPORTS']::"PlanFeature"[], CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

UPDATE "Organization"
SET "planId" = (SELECT "id" FROM "Plan" WHERE "code" = 'organizacional'), "updatedAt" = CURRENT_TIMESTAMP;
