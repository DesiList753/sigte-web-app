import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseJson, withTenant } from "@/lib/api";

export const GET = withTenant(async (req, { session }) => {
  const url = new URL(req.url);
  const summary = url.searchParams.get("summary") === "true";
  const organizationId = session.organizationId;

  if (summary) {
    const unreadCount = await prisma.notification.count({
      where: { organizationId, userId: session.sub, read: false },
    });
    return NextResponse.json({ unreadCount });
  }

  const notifications = await prisma.notification.findMany({
    where: { organizationId, userId: session.sub },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unreadCount = notifications.filter((n) => !n.read).length;
  return NextResponse.json({ notifications, unreadCount });
});

const markSchema = z.union([
  z.object({ ids: z.array(z.string()).min(1) }),
  z.object({ all: z.literal(true) }),
]);

export const POST = withTenant(async (req, { session }) => {
  const parsed = await parseJson(req, markSchema);
  if (!parsed.ok) return parsed.response;
  const organizationId = session.organizationId;

  if ("all" in parsed.data) {
    await prisma.notification.updateMany({
      where: { organizationId, userId: session.sub, read: false },
      data: { read: true },
    });
  } else {
    await prisma.notification.updateMany({
      where: {
        id: { in: parsed.data.ids },
        organizationId,
        userId: session.sub,
      },
      data: { read: true },
    });
  }
  return NextResponse.json({ ok: true });
});
