import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OrgNotice, OrgShell } from "@/components/OrgShell";
import { getAccount } from "@/lib/auth";
import { usesCredentials } from "@/lib/join";
import { publicOrganization } from "@/lib/public-org";
import { RegisterForm } from "./RegisterForm";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const org = await publicOrganization((await params).slug);
  return { title: org ? `Crear cuenta · ${org.displayName}` : "S.I.G.T.E." };
}

export default async function OrganizationRegisterPage({ params }: Props) {
  const org = await publicOrganization((await params).slug);
  if (!org) notFound();
  if (await getAccount()) redirect(`/cuenta/unirse/${org.slug}`);
  const approval = org.joinPolicy === "APPROVAL";

  return (
    <OrgShell org={org} back={`/o/${org.slug}`}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>{approval ? "Solicitar ingreso" : "Crear mi cuenta"}</h1>
      {org.status !== "ACTIVE" ? (
        <OrgNotice tone="warn">
          La cuenta de esta organización está suspendida. Si tienes dudas, contacta a su administración.
        </OrgNotice>
      ) : org.joinPolicy === "INVITE_ONLY" ? (
        <OrgNotice>
          {org.displayName} solo acepta ingresos por invitación. Pide la tuya a su administración.
        </OrgNotice>
      ) : (
        <RegisterForm
          slug={org.slug}
          organizationName={org.displayName}
          form={org.registrationForm}
          domains={org.allowedEmailDomains}
          approval={approval}
          credentials={usesCredentials(org)}
        />
      )}
    </OrgShell>
  );
}
