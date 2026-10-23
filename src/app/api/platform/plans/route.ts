import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withPlatform } from "@/lib/api";

export const GET = withPlatform(async () => {
  const plans = await prisma.plan.findMany({
    orderBy: { maxUsers: { sort: "asc", nulls: "last" } },
    include: { _count: { select: { organizations: true } } },
  });
  return NextResponse.json({ plans });
});
