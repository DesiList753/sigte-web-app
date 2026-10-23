import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, homePath, setSessionCookie } from "@/lib/auth";
import { signToken } from "@/lib/jwt";
import { jsonError, parseJson, planError } from "@/lib/api";
import { auditData } from "@/lib/audit";
import { limitBlock } from "@/lib/plan";
import { formatRut, isValidRut } from "@/lib/rut";

const baseFields = {
  organizationSlug: z.string().min(1),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  phone: z.string().min(6, "Teléfono inválido"),
  universityId: z.string().optional(),
};

const staffSchema = z.object({
  userType: z.literal("STAFF"),
  ...baseFields,
  position: z.string().min(2),
  department: z.string().min(2),
});

const studentSchema = z.object({
  userType: z.literal("STUDENT"),
  ...baseFields,
  rut: z.string().refine(isValidRut, "RUT inválido"),
  academicDepartment: z.string().min(2),
  career: z.string().min(2),
});

const schema = z.discriminatedUnion("userType", [staffSchema, studentSchema]);

function isAllowedEmail(email: string, domains: string[]) {
  if (domains.length === 0) return true;
  const domain = email.split("@")[1] ?? "";
  return domains.some((d) => domain === d || domain.endsWith(`.${d}`));
}

export async function POST(req: NextRequest) {
  const parsed = await parseJson(req, schema);
  if (!parsed.ok) return parsed.response;

  const data = parsed.data;
  const emailLower = data.email.toLowerCase();

  const org = await prisma.organization.findUnique({
    where: { slug: data.organizationSlug },
    select: {
      id: true,
      status: true,
      selfRegistration: true,
      allowedEmailDomains: true,
      plan: {
        select: { name: true, features: true, maxUsers: true, maxGuards: true, maxBlocks: true, maxVehicles: true },
      },
    },
  });
  if (!org) return jsonError(404, "Organización no encontrada");
  if (org.status !== "ACTIVE" || !org.selfRegistration) {
    return jsonError(403, "El registro no está disponible para esta organización");
  }
  if (!isAllowedEmail(emailLower, org.allowedEmailDomains)) {
    return jsonError(400, `Usa un correo de ${org.allowedEmailDomains.join(", ")}`);
  }

  const existing = await prisma.user.findUnique({ where: { email: emailLower } });
  if (existing) return jsonError(409, "El email ya está registrado");

  if (data.universityId) {
    const collision = await prisma.user.findUnique({
      where: { organizationId_universityId: { organizationId: org.id, universityId: data.universityId } },
    });
    if (collision) return jsonError(409, "La credencial universitaria ya existe");
  }

  const rut = data.userType === "STUDENT" ? formatRut(data.rut) : null;
  if (rut) {
    const rutCollision = await prisma.user.findUnique({
      where: { organizationId_rut: { organizationId: org.id, rut } },
    });
    if (rutCollision) return jsonError(409, "El RUT ya está registrado");
  }

  const limited = await limitBlock(org.id, org.plan, "users", { member: true });
  if (limited) return planError(limited);

  const passwordHash = await hashPassword(data.password);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        organizationId: org.id,
        email: emailLower,
        passwordHash,
        name: data.name,
        universityId: data.universityId || null,
        role: "USER",
        userType: data.userType,
        phone: data.phone,
        position: data.userType === "STAFF" ? data.position : null,
        department: data.userType === "STAFF" ? data.department : null,
        rut,
        academicDepartment: data.userType === "STUDENT" ? data.academicDepartment : null,
        career: data.userType === "STUDENT" ? data.career : null,
      },
    });
    await tx.auditLog.create({
      data: auditData({
        organizationId: org.id,
        actor: { sub: created.id, name: created.name },
        action: "CREATE",
        entity: "USER",
        entityId: created.id,
        detail: { email: created.email, role: created.role },
      }),
    });
    return created;
  });

  const token = await signToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    organizationId: org.id,
  });
  await setSessionCookie(token);

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: org.id,
    home: homePath(user.role),
    token,
  });
}
