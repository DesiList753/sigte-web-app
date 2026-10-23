import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson, withTenant } from "@/lib/api";

const patchSchema = z.object({
  status: z.enum(["OPEN", "ACKNOWLEDGED", "RESOLVED", "DISMISSED"]),
  resolution: z.string().optional(),
});

export const PATCH = withTenant<{ id: string }>(
  async (req, { session, params }) => {
    const parsed = await parseJson(req, patchSchema);
    if (!parsed.ok) return parsed.response;

    const infraction = await prisma.infraction.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
    });
    if (!infraction) return jsonError(404, "Infracción no encontrada");

    if (session.role === "USER") {
      if (parsed.data.status !== "ACKNOWLEDGED")
        return jsonError(403, "Solo puedes reconocer la infracción");
      if (infraction.userId !== session.sub)
        return jsonError(403, "No eres el dueño de esta infracción");
      if (infraction.status !== "OPEN")
        return jsonError(400, "La infracción ya fue procesada");
    }

    const resolvedData: Record<string, unknown> = {};
    if (
      session.role !== "USER" &&
      (parsed.data.status === "RESOLVED" || parsed.data.status === "DISMISSED")
    ) {
      resolvedData.resolvedById = session.sub;
      resolvedData.resolvedAt = new Date();
      if (parsed.data.resolution) resolvedData.resolution = parsed.data.resolution;
    }

    const updated = await prisma.infraction.update({
      where: { id: infraction.id },
      data: { status: parsed.data.status, ...resolvedData },
    });

    return NextResponse.json({ infraction: updated });
  },
  { roles: ["USER", "GUARD", "ADMIN"] }
);
