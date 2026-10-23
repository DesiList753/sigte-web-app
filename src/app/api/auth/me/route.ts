import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, resolveActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const actor = await resolveActor(await getSessionFromRequest(req));
  if (!actor) return NextResponse.json({ user: null });

  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      universityId: true,
      organization: { select: { id: true, slug: true, displayName: true, status: true } },
    },
  });
  return NextResponse.json({ user });
}
