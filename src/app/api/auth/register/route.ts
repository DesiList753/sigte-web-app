import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword, homePath, setSessionCookie } from "@/lib/auth";
import { signToken } from "@/lib/jwt";
import { jsonError, parseJson, planError, validate } from "@/lib/api";
import { auditData } from "@/lib/audit";
import { limitBlock } from "@/lib/plan";
import { formatRut, isValidRut } from "@/lib/rut";

const targetSchema = z.looseObject({ organizationSlug: z.string().min(1) });

const baseFields = {
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  phone: z.string().min(6, "Teléfono inválido"),
};

const basicSchema = z.object(baseFields);

const staffSchema = z.object({
  userType: z.literal("STAFF"),
  ...baseFields,
  credentialId: z.string().optional(),
  position: z.string().min(2),
  department: z.string().min(2),
});

const studentSchema = z.object({
  userType: z.literal("STUDENT"),
  ...baseFields,
  credentialId: z.string().optional(),
  rut: z.string().refine(isValidRut, "RUT inválido"),
  academicDepartment: z.string().min(2),
  career: z.string().min(2),
});

const academicSchema = z.discriminatedUnion("userType", [staffSchema, studentSchema]);

type Registration = z.infer<typeof basicSchema> | z.infer<typeof academicSchema>;

type Profile = Pick<
  Prisma.UserUncheckedCreateInput,
  "userType" | "credentialId" | "rut" | "position" | "department" | "academicDepartment" | "career"
>;

function profileOf(data: Registration): Profile {
  if (!("userType" in data)) return {};
  const credentialId = data.credentialId || null;
  if (data.userType === "STAFF") {
    return { userType: "STAFF", credentialId, position: data.position, department: data.department };
  }
  return {
    userType: "STUDENT",
    credentialId,
    rut: formatRut(data.rut),
    academicDepartment: data.academicDepartment,
    career: data.career,
  };
}

function isAllowedEmail(email: string, domains: string[]) {
  if (domains.length === 0) return true;
  const domain = email.split("@")[1] ?? "";
  return domains.some((d) => domain === d || domain.endsWith(`.${d}`));
}

export async function POST(req: NextRequest) {
  const target = await parseJson(req, targetSchema);
  if (!target.ok) return target.response;

  const org = await prisma.organization.findUnique({
    where: { slug: target.data.organizationSlug },
    select: {
      id: true,
      status: true,
      selfRegistration: true,
      registrationForm: true,
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

  const form =
    org.registrationForm === "ACADEMIC" ? validate(target.data, academicSchema) : validate(target.data, basicSchema);
  if (!form.ok) return form.response;

  const data = form.data;
  const emailLower = data.email.toLowerCase();
  if (!isAllowedEmail(emailLower, org.allowedEmailDomains)) {
    return jsonError(400, `Usa un correo de ${org.allowedEmailDomains.join(", ")}`);
  }

  const existing = await prisma.user.findUnique({ where: { email: emailLower } });
  if (existing) return jsonError(409, "El email ya está registrado");

  const profile = profileOf(data);
  if (profile.credentialId) {
    const collision = await prisma.user.findUnique({
      where: { organizationId_credentialId: { organizationId: org.id, credentialId: profile.credentialId } },
    });
    if (collision) return jsonError(409, "La credencial ya existe");
  }

  if (profile.rut) {
    const rutCollision = await prisma.user.findUnique({
      where: { organizationId_rut: { organizationId: org.id, rut: profile.rut } },
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
        role: "USER",
        phone: data.phone,
        ...profile,
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
  });
}
