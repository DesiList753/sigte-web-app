import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withPlatform } from "@/lib/api";

export const GET = withPlatform(async (req) => {
  const url = new URL(req.url);
  const organizationId = url.searchParams.get("organizationId");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10) || 100, 500);

  const logs = await prisma.auditLog.findMany({
    where: organizationId ? { organizationId } : {},
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { organization: { select: { id: true, slug: true, displayName: true } } },
  });
  return NextResponse.json({ logs });
});
