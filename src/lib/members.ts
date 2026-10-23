import type { Prisma, Role } from "@prisma/client";
import { prisma } from "./prisma";

export function ownerSelect(organizationId: string) {
  return {
    id: true,
    name: true,
    email: true,
    memberships: { where: { organizationId }, select: { role: true, credentialId: true } },
  } satisfies Prisma.UserSelect;
}

type WithMemberships = { memberships: { role: Role; credentialId: string | null }[] };

export function flattenOwner<T extends WithMemberships>(owner: T) {
  const { memberships, ...rest } = owner;
  return { ...rest, role: memberships[0]?.role ?? null, credentialId: memberships[0]?.credentialId ?? null };
}

export function withFlatOwner<T extends { owner: WithMemberships }>(vehicle: T) {
  return { ...vehicle, owner: flattenOwner(vehicle.owner) };
}

export function memberByCredential(organizationId: string, credentialId: string) {
  return prisma.membership.findUnique({
    where: { organizationId_credentialId: { organizationId, credentialId } },
    select: { userId: true },
  });
}

export function myOrganizations(userId: string) {
  return prisma.membership.findMany({
    where: { userId, active: true, organization: { status: "ACTIVE" } },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true, organization: { select: { displayName: true } } },
  });
}

export async function organizationOptions(userId: string) {
  const memberships = await myOrganizations(userId);
  return memberships.map((m) => ({ id: m.organizationId, name: m.organization.displayName }));
}
