import { z } from "zod";
import type { JoinPolicy, Prisma, RegistrationForm } from "@prisma/client";
import { jsonError, planError } from "./api";
import { auditData } from "./audit";
import { memberByCredential } from "./members";
import { limitBlock } from "./plan";
import { prisma } from "./prisma";
import { formatRut, isValidRut } from "./rut";

export const staffFields = {
  userType: z.literal("STAFF"),
  credentialId: z.string().optional(),
  position: z.string().min(2),
  department: z.string().min(2),
};

export const studentFields = {
  userType: z.literal("STUDENT"),
  credentialId: z.string().optional(),
  rut: z.string().refine(isValidRut, "RUT inválido"),
  academicDepartment: z.string().min(2),
  career: z.string().min(2),
};

const staffProfile = z.object(staffFields);
const studentProfile = z.object(studentFields);
const academicProfile = z.discriminatedUnion("userType", [staffProfile, studentProfile]);

export function profileSchema(form: RegistrationForm): z.ZodType<object> {
  return form === "ACADEMIC" ? academicProfile : z.object({});
}

export type MemberProfile = Pick<
  Prisma.MembershipUncheckedCreateInput,
  "userType" | "credentialId" | "position" | "department" | "academicDepartment" | "career"
>;

export function usesCredentials(org: { credentialsEnabled: boolean; plan: { features: string[] } }) {
  return org.credentialsEnabled && org.plan.features.includes("CREDENTIALS");
}

export function profileOf(input: object, credentials: boolean): { member: MemberProfile; rut: string | null } {
  const data = "userType" in input ? (input as z.infer<typeof academicProfile>) : null;
  if (!data) return { member: {}, rut: null };
  const credentialId = (credentials && data.credentialId) || null;
  if (data.userType === "STAFF") {
    return {
      member: {
        userType: "STAFF",
        credentialId,
        position: data.position,
        department: data.department,
      },
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

export const joinOrganizationSelect = {
  id: true,
  displayName: true,
  status: true,
  joinPolicy: true,
  credentialsEnabled: true,
  registrationForm: true,
  allowedEmailDomains: true,
  plan: {
    select: { name: true, features: true, maxUsers: true, maxGuards: true, maxBlocks: true, maxVehicles: true },
  },
} satisfies Prisma.OrganizationSelect;

export type JoinOrganization = Prisma.OrganizationGetPayload<{ select: typeof joinOrganizationSelect }>;

function isAllowedEmail(email: string, domains: string[]) {
  if (domains.length === 0) return true;
  const domain = email.split("@")[1] ?? "";
  return domains.some((d) => domain === d || domain.endsWith(`.${d}`));
}

export function closedBlock(org: JoinOrganization) {
  if (org.status === "ACTIVE" && org.joinPolicy !== "INVITE_ONLY") return null;
  return jsonError(403, "El registro no está disponible para esta organización");
}

export function emailBlock(org: JoinOrganization, email: string) {
  if (isAllowedEmail(email, org.allowedEmailDomains)) return null;
  return jsonError(400, `Usa un correo de ${org.allowedEmailDomains.join(", ")}`);
}

export function previousRequestBlock(previous: { status: string } | undefined) {
  if (previous?.status === "ACTIVE") return jsonError(409, "Ya perteneces a esta organización. Inicia sesión.");
  if (previous?.status === "PENDING") {
    return jsonError(409, "Ya enviaste una solicitud a esta organización. Espera la respuesta de su administración.");
  }
  return null;
}

export async function seatBlock(org: JoinOrganization, credentialId: string | null | undefined, previousId?: string) {
  if (credentialId) {
    const collision = await memberByCredential(org.id, credentialId);
    if (collision && collision.id !== previousId) return jsonError(409, "La credencial ya existe");
  }
  if (pendingFor(org.joinPolicy)) return null;
  const limited = await limitBlock(org.id, org.plan, "users", { member: true });
  return limited ? planError(limited) : null;
}

export async function rutBlock(rut: string | null, currentRut: string | null | undefined) {
  if (!rut) return null;
  if (currentRut) return currentRut === rut ? null : jsonError(409, "El RUT no coincide con el de tu cuenta");
  const owner = await prisma.user.findUnique({ where: { rut }, select: { id: true } });
  return owner ? jsonError(409, "El RUT ya está registrado") : null;
}

export function pendingFor(policy: JoinPolicy) {
  return policy !== "OPEN";
}

export async function notifyAdmins(
  tx: Prisma.TransactionClient,
  organizationId: string,
  notice: { title: string; message: string }
) {
  const admins = await tx.membership.findMany({
    where: { organizationId, role: "ADMIN", active: true, status: "ACTIVE" },
    select: { userId: true },
  });
  if (admins.length === 0) return;
  await tx.notification.createMany({
    data: admins.map((a) => ({ organizationId, userId: a.userId, kind: "SYSTEM" as const, ...notice })),
  });
}

export async function addMember(
  tx: Prisma.TransactionClient,
  input: {
    org: Pick<JoinOrganization, "id" | "joinPolicy">;
    person: { id: string; name: string; email: string };
    member: MemberProfile;
    previousId?: string;
  }
) {
  const { org, person, member, previousId } = input;
  const pending = pendingFor(org.joinPolicy);
  const state = pending
    ? { status: "PENDING" as const, active: false }
    : { status: "ACTIVE" as const, active: true };

  if (previousId) {
    await tx.membership.update({
      where: { id: previousId },
      data: {
        role: "USER",
        userType: null,
        credentialId: null,
        position: null,
        department: null,
        academicDepartment: null,
        career: null,
        ...member,
        ...state,
      },
    });
  } else {
    await tx.membership.create({
      data: { userId: person.id, organizationId: org.id, role: "USER", ...member, ...state },
    });
  }

  if (pending) {
    await notifyAdmins(tx, org.id, {
      title: "Nueva solicitud de ingreso",
      message: `${person.name} (${person.email}) pidió unirse a la organización. Revísala en Solicitudes.`,
    });
  } else {
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
  }
  return { pending };
}
