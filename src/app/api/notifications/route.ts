import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseJson, withTenant } from "@/lib/api";

export const GET = withTenant(async (_req, { session }) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: session.sub },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ notifications });
});

const markSchema = z.object({ ids: z.array(z.string()).min(1) });

export const POST = withTenant(async (req, { session }) => {
  const parsed = await parseJson(req, markSchema);
  if (!parsed.ok) return parsed.response;
  await prisma.notification.updateMany({
    where: { id: { in: parsed.data.ids }, userId: session.sub },
    data: { read: true },
  });
  return NextResponse.json({ ok: true });
});
