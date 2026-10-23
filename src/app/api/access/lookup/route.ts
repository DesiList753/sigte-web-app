import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError, planError, withTenant } from "@/lib/api";
import { featureBlock } from "@/lib/plan";
import { verifyQrToken } from "@/lib/qr";

const include = {
  owner: { select: { id: true, name: true, email: true, credentialId: true } },
  currentBlock: true,
} satisfies Prisma.VehicleInclude;

export const GET = withTenant(
  async (req, { session }) => {
    const url = new URL(req.url);
    const plate = url.searchParams.get("plate")?.toUpperCase().replace(/\s+/g, "");
    const qr = url.searchParams.get("qr");
    const uid = url.searchParams.get("uid");
    const organizationId = session.organizationId;

    let vehicle = null;
    if (plate) {
      vehicle = await prisma.vehicle.findUnique({
        where: { organizationId_plate: { organizationId, plate } },
        include,
      });
    } else if (qr) {
      const blocked = featureBlock(session.plan, "QR");
      if (blocked) return planError(blocked);
      const vResult = verifyQrToken(qr);
      if (!vResult.ok) {
        return NextResponse.json({ vehicle: null, qrError: vResult.error });
      }
      vehicle = await prisma.vehicle.findFirst({
        where: { id: vResult.vehicleId, organizationId },
        include,
      });
    } else if (uid) {
      const owner = await prisma.user.findUnique({
        where: { organizationId_credentialId: { organizationId, credentialId: uid } },
      });
      if (owner) {
        vehicle = await prisma.vehicle.findFirst({
          where: { ownerId: owner.id, organizationId },
          orderBy: { createdAt: "desc" },
          include,
        });
      }
    } else {
      return jsonError(400, "Indica plate, qr o uid");
    }

    if (!vehicle) return NextResponse.json({ vehicle: null });

    const openInfractions = session.plan.features.includes("INFRACTIONS")
      ? await prisma.infraction.count({ where: { vehicleId: vehicle.id, status: "OPEN" } })
      : 0;

    return NextResponse.json({ vehicle, openInfractions });
  },
  { roles: ["GUARD", "ADMIN"] }
);
