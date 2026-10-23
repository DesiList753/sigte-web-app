import type { Role } from "@prisma/client";
import { prisma } from "./prisma";

const organizationSelect = {
  status: true,
  slug: true,
  name: true,
  displayName: true,
  logoUrl: true,
  brandColor: true,
  plan: {
    select: {
      name: true,
      features: true,
      maxUsers: true,
      maxGuards: true,
      maxBlocks: true,
      maxVehicles: true,
    },
  },
} as const;

export async function loadActor(id: string, organizationId: string | null) {
  if (!organizationId) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, platformAdmin: true },
    });
    if (!user?.platformAdmin) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: "SUPER_ADMIN" as Role,
      active: true,
      organizationId: null,
      organization: null,
    };
  }
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: id, organizationId } },
    select: {
      role: true,
      active: true,
      user: { select: { id: true, email: true, name: true } },
      organization: { select: organizationSelect },
    },
  });
  if (!membership) return null;
  return {
    id: membership.user.id,
    email: membership.user.email,
    name: membership.user.name,
    role: membership.role,
    active: membership.active,
    organizationId: organizationId as string | null,
    organization: membership.organization,
  };
}

export type Actor = NonNullable<Awaited<ReturnType<typeof loadActor>>>;
