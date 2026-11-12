import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ACCOUNT_HOME, hashPassword, homePath, setSessionCookie, verifyPassword } from "@/lib/auth";
import { signToken } from "@/lib/jwt";
import { jsonError, parseJson, validate } from "@/lib/api";
import {
  addMember,
  closedBlock,
  emailBlock,
  joinOrganizationSelect,
  pendingFor,
  previousRequestBlock,
  profileOf,
  rutBlock,
  seatBlock,
  staffFields,
  studentFields,
  usesCredentials,
} from "@/lib/join";
import { LOCK_MS, isLocked, minutesRemaining, shouldLock } from "@/lib/loginPolicy";

const targetSchema = z.looseObject({ organizationSlug: z.string().min(1) });

const baseFields = {
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(1),
  phone: z.string().min(6, "Teléfono inválido"),
};

const basicSchema = z.object(baseFields);

const academicSchema = z.discriminatedUnion("userType", [
  z.object({ ...baseFields, ...staffFields }),
  z.object({ ...baseFields, ...studentFields }),
]);

export async function POST(req: NextRequest) {
  const target = await parseJson(req, targetSchema);
  if (!target.ok) return target.response;

  const org = await prisma.organization.findUnique({
    where: { slug: target.data.organizationSlug },
    select: joinOrganizationSelect,
  });
  if (!org) return jsonError(404, "Organización no encontrada");
  const closed = closedBlock(org);
  if (closed) return closed;

  const form =
    org.registrationForm === "ACADEMIC" ? validate(target.data, academicSchema) : validate(target.data, basicSchema);
  if (!form.ok) return form.response;

  const data = form.data;
  const emailLower = data.email.toLowerCase();
  const wrongEmail = emailBlock(org, emailLower);
  if (wrongEmail) return wrongEmail;

  const { member, rut } = profileOf(data, usesCredentials(org));
  const existing = await prisma.user.findUnique({
    where: { email: emailLower },
    select: {
      id: true,
      passwordHash: true,
      platformAdmin: true,
      rut: true,
      failedLoginAttempts: true,
      lockedUntil: true,
      memberships: { where: { organizationId: org.id }, select: { id: true, status: true } },
    },
  });
  const previous = existing?.memberships[0];

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
    const repeated = previousRequestBlock(previous);
    if (repeated) return repeated;
  } else if (data.password.length < 8) {
    return jsonError(400, "La contraseña debe tener al menos 8 caracteres");
  }

  const rutProblem = await rutBlock(rut, existing?.rut);
  if (rutProblem) return rutProblem;
  const noSeat = await seatBlock(org, member.credentialId, previous?.id);
  if (noSeat) return noSeat;

  const setsRut = !!rut && !existing?.rut;
  const passwordHash = existing ? null : await hashPassword(data.password);
  const pending = pendingFor(org.joinPolicy);
  const lastOrganization = pending ? {} : { lastOrganizationId: org.id };
  const user = await prisma.$transaction(async (tx) => {
    const person = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: { ...lastOrganization, failedLoginAttempts: 0, lockedUntil: null, ...(setsRut ? { rut } : {}) },
          select: { id: true, email: true, name: true },
        })
      : await tx.user.create({
          data: {
            email: emailLower,
            passwordHash: passwordHash!,
            name: data.name,
            phone: data.phone,
            rut,
            ...lastOrganization,
          },
          select: { id: true, email: true, name: true },
        });
    await addMember(tx, { org, person, member, previousId: previous?.id });
    return person;
  });

  const organizationId = pending ? null : org.id;
  const token = await signToken({ sub: user.id, email: user.email, role: "USER", name: user.name, organizationId });
  await setSessionCookie(token);

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: "USER",
    organizationId,
    joined: !!existing,
    pending,
    home: pending ? ACCOUNT_HOME : homePath("USER"),
  });
}
