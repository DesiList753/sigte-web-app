import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ACCOUNT_HOME, homePath, setSessionCookie } from "@/lib/auth";
import { signToken } from "@/lib/jwt";
import { jsonError, parseJson, validate, withAccount } from "@/lib/api";
import {
  addMember,
  closedBlock,
  emailBlock,
  joinOrganizationSelect,
  pendingFor,
  previousRequestBlock,
  profileOf,
  profileSchema,
  rutBlock,
  seatBlock,
  usesCredentials,
} from "@/lib/join";

const targetSchema = z.looseObject({ organizationSlug: z.string().min(1) });

export const POST = withAccount(async (req, { account }) => {
  const target = await parseJson(req, targetSchema);
  if (!target.ok) return target.response;

  const org = await prisma.organization.findUnique({
    where: { slug: target.data.organizationSlug },
    select: joinOrganizationSelect,
  });
  if (!org) return jsonError(404, "Organización no encontrada");

  const unavailable = closedBlock(org) ?? emailBlock(org, account.email);
  if (unavailable) return unavailable;

  const form = validate(target.data, profileSchema(org.registrationForm));
  if (!form.ok) return form.response;
  const { member, rut } = profileOf(form.data, usesCredentials(org));

  const previous = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: account.id, organizationId: org.id } },
    select: { id: true, status: true },
  });
  const repeated = previousRequestBlock(previous ?? undefined);
  if (repeated) return repeated;

  const rutProblem = await rutBlock(rut, account.rut);
  if (rutProblem) return rutProblem;
  const noSeat = await seatBlock(org, member.credentialId, previous?.id);
  if (noSeat) return noSeat;

  const pending = pendingFor(org.joinPolicy);
  const changes = {
    ...(rut && !account.rut ? { rut } : {}),
    ...(pending ? {} : { lastOrganizationId: org.id }),
  };
  await prisma.$transaction(async (tx) => {
    if (Object.keys(changes).length > 0) await tx.user.update({ where: { id: account.id }, data: changes });
    await addMember(tx, { org, person: account, member, previousId: previous?.id });
  });

  if (!pending) {
    const token = await signToken({
      sub: account.id,
      email: account.email,
      role: "USER",
      name: account.name,
      organizationId: org.id,
    });
    await setSessionCookie(token);
  }

  return NextResponse.json(
    { organizationId: org.id, pending, home: pending ? ACCOUNT_HOME : homePath("USER") },
    { status: 201 }
  );
});
