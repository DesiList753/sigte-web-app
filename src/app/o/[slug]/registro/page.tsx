import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OrgNotice, OrgShell } from "@/components/OrgShell";
import { getActor, homePath } from "@/lib/auth";
import { publicOrganization } from "@/lib/public-org";
import { RegisterForm } from "./RegisterForm";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const org = await publicOrganization((await params).slug);
  return { title: org ? `Crear cuenta · ${org.displayName}` : "S.I.G.T.E" };
}

export default async function OrganizationRegisterPage({ params }: Props) {
  const org = await publicOrganization((await params).slug);
  if (!org) notFound();
  const actor = await getActor();
  if (actor) redirect(homePath(actor.role));

  return (
    <OrgShell org={org} back={`/o/${org.slug}`}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Crear mi cuenta</h1>
      {org.status !== "ACTIVE" ? (
        <OrgNotice tone="warn">
          La cuenta de esta organización está suspendida. Si tienes dudas, contacta a su administración.
        </OrgNotice>
      ) : !org.selfRegistration ? (
        <OrgNotice>
          {org.displayName} no tiene el registro abierto. Pide tu cuenta a su administración.
        </OrgNotice>
      ) : (
        <RegisterForm
          slug={org.slug}
          organizationName={org.displayName}
          form={org.registrationForm}
          domains={org.allowedEmailDomains}
        />
      )}
    </OrgShell>
  );
}
