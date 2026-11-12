-- Renombra únicamente la etiqueta visible de los planes.
-- Los códigos, límites y funciones se mantienen intactos.
UPDATE "Plan" SET "name" = 'Tier 1' WHERE "code" IN ('basico', 'estandar', 'standard');
UPDATE "Plan" SET "name" = 'Tier 2' WHERE "code" IN ('profesional', 'professional');
UPDATE "Plan" SET "name" = 'Tier 3' WHERE "code" IN ('institucional', 'institutional');
