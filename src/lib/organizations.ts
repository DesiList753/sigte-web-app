import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { SLUG_PATTERN } from "./slug";

export const SIGNUP_PLAN = "basico";

export const DEFAULT_BLOCK = {
  name: "No definido",
  description: "Bloque por defecto — asignar luego",
  capacity: 100,
};

export const slugSchema = z
  .string()
  .min(3, "El slug debe tener al menos 3 caracteres")
  .max(40)
  .regex(SLUG_PATTERN, "Usa solo minúsculas, números y guiones");

export async function createOrganization(
  tx: Prisma.TransactionClient,
  input: {
    name: string;
    displayName: string;
    slug: string;
    planId: string;
    admin: { name: string; email: string; passwordHash: string };
  }
) {
  const organization = await tx.organization.create({
    data: { name: input.name, displayName: input.displayName, slug: input.slug, planId: input.planId },
  });
  await tx.parkingBlock.create({
    data: { organizationId: organization.id, ...DEFAULT_BLOCK, defaultOf: { connect: { id: organization.id } } },
  });
  const admin = await tx.user.create({
    data: {
      email: input.admin.email,
      passwordHash: input.admin.passwordHash,
      name: input.admin.name,
      lastOrganizationId: organization.id,
      memberships: { create: { organizationId: organization.id, role: "ADMIN" } },
    },
  });
  return { organization, admin: { ...admin, role: "ADMIN" as const } };
}
