import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/api";

export const GET = withTenant(
  async (req, { session }) => {
    const limit = Math.min(parseInt(new URL(req.url).searchParams.get("limit") ?? "100", 10) || 100, 500);
    const logs = await prisma.auditLog.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return NextResponse.json({ logs });
  },
  { roles: ["ADMIN"] }
);
