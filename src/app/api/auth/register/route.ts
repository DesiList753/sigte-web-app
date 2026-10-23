import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword, homePath, setSessionCookie, verifyPassword } from "@/lib/auth";
import { signToken } from "@/lib/jwt";
import { jsonError, parseJson, planError, validate } from "@/lib/api";
import { auditData } from "@/lib/audit";
import { LOCK_MS, isLocked, minutesRemaining, shouldLock } from "@/lib/loginPolicy";
import { memberByCredential } from "@/lib/members";
import { limitBlock } from "@/lib/plan";
import { formatRut, isValidRut } from "@/lib/rut";

const targetSchema = z.looseObject({ organizationSlug: z.string().min(1) });

const baseFields = {
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(1),
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

type MemberProfile = Pick<
  Prisma.MembershipUncheckedCreateInput,
  "userType" | "credentialId" | "position" | "department" | "academicDepartment" | "career"
>;

function profileOf(data: Registration): { member: MemberProfile; rut: string | null } {
  if (!("userType" in data)) return { member: {}, rut: null };
  const credentialId = data.credentialId || null;
  if (data.userType === "STAFF") {
    return {
      member: { userType: "STAFF", credentialId, position: data.position, department: data.department },
      rut: null,
    };
  }
  return {
    member: {
      userType: "STUDENT",
      credentialId,
      academicDepartment: data.academicDepartment,
      career: data.career,
    },
    rut: formatRut(data.rut),
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

  const { member, rut } = profileOf(data);
  const existing = await prisma.user.findUnique({
    where: { email: emailLower },
    select: {
      id: true,
      passwordHash: true,
      platformAdmin: true,
      rut: true,
      failedLoginAttempts: true,
      lockedUntil: true,
      memberships: { where: { organizationId: org.id }, select: { id: true } },
    },
  });

  if (existing) {
    if (existing.platformAdmin) return jsonError(409, "El email ya está registrado");
    if (isLocked(existing.lockedUntil)) {
      return jsonError(
        429,
        `Demasiados intentos fallidos. Intenta de nuevo en ${minutesRemaining(existing.lockedUntil!)} minuto(s).`
      );
    }
    if (!(await verifyPassword(data.password, existing.passwordHash))) {
      const attempts = existing.failedLoginAttempts + 1;
      await prisma.user.update({
        where: { id: existing.id },
        data: shouldLock(attempts)
          ? { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + LOCK_MS) }
          : { failedLoginAttempts: attempts },
      });
      return jsonError(
        409,
        "Ese correo ya tiene cuenta en S.I.G.T.E. Escribe tu contraseña actual para unirte a esta organización.",
        { code: "ACCOUNT_EXISTS" }
      );
    }
    if (existing.memberships.length > 0) return jsonError(409, "Ya perteneces a esta organización. Inicia sesión.");
    if (rut && existing.rut && existing.rut !== rut) return jsonError(409, "El RUT no coincide con el de tu cuenta");
  } else if (data.password.length < 8) {
    return jsonError(400, "La contraseña debe tener al menos 8 caracteres");
  }

  if (member.credentialId) {
    const collision = await memberByCredential(org.id, member.credentialId);
    if (collision) return jsonError(409, "La credencial ya existe");
  }

  const setsRut = !!rut && !existing?.rut;
  if (setsRut) {
    const rutCollision = await prisma.user.findUnique({ where: { rut: rut! }, select: { id: true } });
    if (rutCollision) return jsonError(409, "El RUT ya está registrado");
  }

  const limited = await limitBlock(org.id, org.plan, "users", { member: true });
  if (limited) return planError(limited);

  const passwordHash = existing ? null : await hashPassword(data.password);
  const user = await prisma.$transaction(async (tx) => {
    const person = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: { lastOrganizationId: org.id, failedLoginAttempts: 0, lockedUntil: null, ...(setsRut ? { rut } : {}) },
          select: { id: true, email: true, name: true },
        })
      : await tx.user.create({
          data: {
            email: emailLower,
            passwordHash: passwordHash!,
            name: data.name,
            phone: data.phone,
            rut,
            lastOrganizationId: org.id,
          },
          select: { id: true, email: true, name: true },
        });
    await tx.membership.create({ data: { userId: person.id, organizationId: org.id, role: "USER", ...member } });
    await tx.auditLog.create({
      data: auditData({
        organizationId: org.id,
        actor: { sub: person.id, name: person.name },
        action: "CREATE",
        entity: "USER",
        entityId: person.id,
        detail: { email: person.email, role: "USER" },
      }),
    });
    return person;
  });

  const token = await signToken({
    sub: user.id,
    email: user.email,
    role: "USER",
    name: user.name,
    organizationId: org.id,
  });
  await setSessionCookie(token);

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: "USER",
    organizationId: org.id,
    joined: !!existing,
    home: homePath("USER"),
  });
}
