import { prisma } from "./prisma";

export function loadActor(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      organizationId: true,
      organization: { select: { status: true } },
    },
  });
}

export type Actor = NonNullable<Awaited<ReturnType<typeof loadActor>>>;
