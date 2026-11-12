import type { Metadata } from "next";
import Link from "next/link";
import { OrgNotice, OrgShell } from "@/components/OrgShell";
import { Card, ProductBrand } from "@/components/ui-system";
import { requireAccount } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { usesCredentials } from "@/lib/join";
import { publicOrganization } from "@/lib/public-org";
import { JoinForm } from "./JoinForm";

type Props = { params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: "Unirme a una organización · S.I.G.T.E." };

export default async function JoinOrganizationPage({ params }: Props) {
  const account = await requireAccount();
  const org = await publicOrganization((await params).slug);

  if (!org) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", padding: 24 }}>
        <Card style={{ width: "100%", maxWidth: 460 }}>
          <div style={{ display: "flex", marginBottom: 22 }}>
            <ProductBrand />
          </div>
          <h1 style={{ fontSize: 22, marginBottom: 6 }}>No encontramos esa organización</h1>
          <p style={{ color: "var(--ink-500)", fontSize: 13.5, marginBottom: 20, lineHeight: 1.55 }}>
            Revisa el código o el enlace que te entregaron e inténtalo de nuevo.
          </p>
          <Link href="/cuenta" className="btn secondary block">
            Volver a mis organizaciones
          </Link>
        </Card>
      </main>
    );
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: account.id, organization: { slug: org.slug } },
    select: { status: true },
  });
  const approval = org.joinPolicy === "APPROVAL";

  return (
    <OrgShell org={org} back="/cuenta">
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>{approval ? "Solicitar ingreso" : "Unirme"}</h1>
      {org.status !== "ACTIVE" ? (
        <OrgNotice tone="warn">
          La cuenta de esta organización está suspendida. Si tienes dudas, contacta a su administración.
        </OrgNotice>
      ) : membership?.status === "ACTIVE" ? (
        <OrgNotice>Ya perteneces a {org.displayName}. Entra desde tus organizaciones.</OrgNotice>
      ) : membership?.status === "PENDING" ? (
        <OrgNotice>
          Tu solicitud ya fue enviada. Podrás entrar cuando la administración de {org.displayName} la acepte.
        </OrgNotice>
      ) : org.joinPolicy === "INVITE_ONLY" ? (
        <OrgNotice>
          {org.displayName} solo acepta ingresos por invitación. Pide la tuya a su administración.
        </OrgNotice>
      ) : (
        <JoinForm
          slug={org.slug}
          organizationName={org.displayName}
          form={org.registrationForm}
          email={account.email}
          approval={approval}
          credentials={usesCredentials(org)}
        />
      )}
    </OrgShell>
  );
}
