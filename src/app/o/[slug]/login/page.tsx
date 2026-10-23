import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";
import { OrgNotice, OrgShell } from "@/components/OrgShell";
import { getActor, homePath } from "@/lib/auth";
import { publicOrganization } from "@/lib/public-org";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const org = await publicOrganization((await params).slug);
  return { title: org ? `Iniciar sesión · ${org.displayName}` : "S.I.G.T.E" };
}

export default async function OrganizationLoginPage({ params }: Props) {
  const org = await publicOrganization((await params).slug);
  if (!org) notFound();
  const actor = await getActor();
  if (actor) redirect(homePath(actor.role));

  return (
    <OrgShell org={org} back={`/o/${org.slug}`}>
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>Iniciar sesión</h1>
      {org.status !== "ACTIVE" ? (
        <OrgNotice tone="warn">
          La cuenta de esta organización está suspendida. Si tienes dudas, contacta a su administración.
        </OrgNotice>
      ) : (
        <Suspense fallback={<p className="muted" style={{ fontSize: 13 }}>Cargando…</p>}>
          <LoginForm
            organizationSlug={org.slug}
            registerHref={org.selfRegistration ? `/o/${org.slug}/registro` : null}
          />
        </Suspense>
      )}
    </OrgShell>
  );
}
