import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { jsonError, withTenant } from "@/lib/api";
import { signQrToken } from "@/lib/qr";

export const GET = withTenant(async (req, { session }) => {
  const url = new URL(req.url);
  const vehicleId = url.searchParams.get("vehicleId");
  if (!vehicleId) return jsonError(400, "vehicleId requerido");

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, organizationId: session.organizationId },
  });
  if (!vehicle) return jsonError(404, "Vehículo no encontrado");

  if (session.role === "USER" && vehicle.ownerId !== session.sub)
    return jsonError(403, "No es tu vehículo");

  const issuedAt = Date.now();
  const expiresAt = issuedAt + 5 * 60_000;
  const token = signQrToken(vehicle.id, issuedAt);
  const dataUrl = await QRCode.toDataURL(token, {
    margin: 1,
    width: 360,
    color: { dark: "#0f172a", light: "#ffffff" },
  });

  return NextResponse.json({
    token,
    dataUrl,
    vehicle: { id: vehicle.id, plate: vehicle.plate },
    issuedAt,
    expiresAt,
  });
}, { feature: "QR" });
