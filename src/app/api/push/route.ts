import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseJson, withTenant } from "@/lib/api";

const registerSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(["ios", "android", "web"]).optional(),
  device: z.string().optional(),
});

export const POST = withTenant(async (req, { session }) => {
  const parsed = await parseJson(req, registerSchema);
  if (!parsed.ok) return parsed.response;
  const { token, platform, device } = parsed.data;

  await prisma.pushToken.upsert({
    where: { token },
    create: { userId: session.sub, token, platform, device },
    update: { userId: session.sub, platform, device },
  });

  return NextResponse.json({ ok: true });
});

const deleteSchema = z.object({ token: z.string().min(1) });

export const DELETE = withTenant(async (req, { session }) => {
  const parsed = await parseJson(req, deleteSchema);
  if (!parsed.ok) return parsed.response;

  await prisma.pushToken.deleteMany({
    where: { token: parsed.data.token, userId: session.sub },
  });

  return NextResponse.json({ ok: true });
});
