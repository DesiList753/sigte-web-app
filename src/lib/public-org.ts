import { cache } from "react";
import { prisma } from "./prisma";

export const publicOrganization = cache((slug: string) =>
  prisma.organization.findUnique({
    where: { slug },
    select: {
      slug: true,
      name: true,
      displayName: true,
      logoUrl: true,
      brandColor: true,
      status: true,
      selfRegistration: true,
      registrationForm: true,
      allowedEmailDomains: true,
    },
  })
);

export type PublicOrganization = NonNullable<Awaited<ReturnType<typeof publicOrganization>>>;
