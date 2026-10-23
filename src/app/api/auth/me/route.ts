import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, resolveActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const actor = await resolveActor(await getSessionFromRequest(req));
  if (!actor) return NextResponse.json({ user: null });

  const memberships = await prisma.membership.findMany({
    where: { userId: actor.id, active: true },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      credentialId: true,
      organization: { select: { id: true, slug: true, displayName: true, status: true } },
    },
  });
  const current = memberships.find((m) => m.organization.id === actor.organizationId);

  return NextResponse.json({
    user: {
      id: actor.id,
      email: actor.email,
      name: actor.name,
      role: actor.role,
      credentialId: current?.credentialId ?? null,
      organization: current?.organization ?? null,
      organizations: memberships.map((m) => ({ ...m.organization, role: m.role })),
    },
  });
}
