import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { memberByCredential } from "@/lib/members";
import { jsonError, parseJson, planError, withTenant } from "@/lib/api";
import { featureBlock } from "@/lib/plan";
import { verifyQrToken } from "@/lib/qr";

export const GET = withTenant(async (req, { session }) => {
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 500);
  const format = url.searchParams.get("format");
  const blocked = format === "csv" ? featureBlock(session.plan, "REPORTS") : null;
  if (blocked) return planError(blocked);

  const where: Prisma.AccessLogWhereInput = { organizationId: session.organizationId };
  if (session.role === "USER") {
    where.vehicle = { ownerId: session.sub };
  }

  const logs = await prisma.accessLog.findMany({
    where,
    orderBy: { timestamp: "desc" },
    take: limit,
    include: {
      vehicle: { include: { owner: { select: { id: true, name: true } } } },
      guard: { select: { id: true, name: true } },
      block: { select: { id: true, name: true } },
    },
  });

  if (format === "csv") {
    const headers = ["timestamp", "plate", "owner", "method", "direction", "block", "guard", "authorized", "note"];
    const rows = logs.map((l) => [
      l.timestamp.toISOString(),
      l.vehicle.plate,
      l.vehicle.owner?.name ?? "",
      l.method,
      l.direction,
      l.block?.name ?? "",
      l.guard?.name ?? "",
      l.authorized ? "Autorizado" : "Rechazado",
      l.note ?? "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))].join("\n");
    return new NextResponse(csv, {
      status: 200,
      headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=\"bitacora.csv\"" },
    });
  }

  return NextResponse.json({ logs });
});

const logSchema = z.object({
  plate: z.string().optional(),
  vehicleId: z.string().optional(),
  qrToken: z.string().optional(),
  credentialId: z.string().optional(),
  method: z.enum(["PLATE", "QR", "CARD", "MANUAL"]),
  direction: z.enum(["IN", "OUT"]),
  blockId: z.string().optional(),
  note: z.string().optional(),
});

export const POST = withTenant(
  async (req, { session }) => {
    const parsed = await parseJson(req, logSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const organizationId = session.organizationId;

    const blocked = body.qrToken || body.method === "QR" ? featureBlock(session.plan, "QR") : null;
    if (blocked) return planError(blocked);

    let vehicle = null;
    if (body.vehicleId) {
      vehicle = await prisma.vehicle.findFirst({ where: { id: body.vehicleId, organizationId } });
    } else if (body.plate) {
      const plate = body.plate.toUpperCase().replace(/\s+/g, "");
      vehicle = await prisma.vehicle.findUnique({ where: { organizationId_plate: { organizationId, plate } } });
    } else if (body.qrToken) {
      const verified = verifyQrToken(body.qrToken);
      if (!verified.ok) {
        return jsonError(400, verified.error === "expirado" ? "QR expirado (válido por 5 minutos)" : "QR inválido");
      }
      vehicle = await prisma.vehicle.findFirst({ where: { id: verified.vehicleId, organizationId } });
    } else if (body.credentialId) {
      const member = await memberByCredential(organizationId, body.credentialId);
      if (member) {
        vehicle = await prisma.vehicle.findFirst({
          where: { ownerId: member.userId, organizationId },
          orderBy: { createdAt: "desc" },
        });
      }
    }

    if (!vehicle) return jsonError(404, "Vehículo no encontrado");

    let blockToAssign = body.blockId ?? null;
    if (body.direction === "IN" && !blockToAssign) {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { defaultBlockId: true },
      });
      blockToAssign = org?.defaultBlockId ?? null;
    }

    if (blockToAssign) {
      const block = await prisma.parkingBlock.findFirst({ where: { id: blockToAssign, organizationId } });
      if (!block) return jsonError(404, "Bloque no encontrado");
      if (body.direction === "IN") {
        const occupied = await prisma.vehicle.count({ where: { currentBlockId: block.id } });
        if (occupied >= block.capacity) {
          return jsonError(409, `Bloque ${block.name} lleno (${occupied}/${block.capacity})`);
        }
      }
    }

    let warning: string | undefined;
    if (body.direction === "IN" && !vehicle.authorized) {
      warning = "Vehículo no autorizado. Acceso registrado con advertencia.";
    }

    const log = await prisma.accessLog.create({
      data: {
        organizationId,
        vehicleId: vehicle.id,
        userId: vehicle.ownerId,
        guardId: session.sub,
        method: body.method,
        direction: body.direction,
        blockId: blockToAssign,
        authorized: vehicle.authorized,
        note: body.note ?? warning,
      },
      include: {
        vehicle: { include: { owner: { select: { id: true, name: true, email: true } } } },
        block: true,
      },
    });

    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { currentBlockId: body.direction === "IN" ? blockToAssign : null },
    });

    const title = body.direction === "IN" ? "Ingreso registrado" : "Salida registrada";
    const message =
      body.direction === "IN"
        ? `Vehículo ${vehicle.plate} ingresó${log.block ? ` a ${log.block.name}` : ""}.`
        : `Vehículo ${vehicle.plate} salió.`;

    await prisma.notification.create({
      data: { organizationId, userId: vehicle.ownerId, title, message },
    });

    return NextResponse.json({ log, authorized: vehicle.authorized, warning }, { status: 201 });
  },
  { roles: ["GUARD", "ADMIN"] }
);
