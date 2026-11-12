import type { Metadata } from "next";
import Link from "next/link";
import { OrgNotice, OrgShell } from "@/components/OrgShell";
import { Card, ProductBrand } from "@/components/ui-system";
import { getAccount } from "@/lib/auth";
import { hashResetToken } from "@/lib/passwordReset";
import { prisma } from "@/lib/prisma";
import { publicOrganization } from "@/lib/public-org";
import { AcceptInvitation, SwitchAccount } from "./AcceptInvitation";

type Props = { params: Promise<{ token: string }> };

export const metadata: Metadata = { title: "Invitación · S.I.G.T.E." };

const ROLE_LABEL = { USER: "usuario", GUARD: "guardia", ADMIN: "administrador", SUPER_ADMIN: "plataforma" };

export default async function InvitationPage({ params }: Props) {
  const { token } = await params;
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashResetToken(token) },
    select: { email: true, role: true, expiresAt: true, organization: { select: { slug: true } } },
  });
  const org = invitation && invitation.expiresAt > new Date() ? await publicOrganization(invitation.organization.slug) : null;

  if (!invitation || !org) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", padding: 24 }}>
        <Card style={{ width: "100%", maxWidth: 460 }}>
          <div style={{ display: "flex", marginBottom: 22 }}>
            <ProductBrand />
          </div>
          <h1 style={{ fontSize: 22, marginBottom: 6 }}>Invitación no disponible</h1>
          <p style={{ color: "var(--ink-500)", fontSize: 13.5, marginBottom: 20, lineHeight: 1.55 }}>
            Esta invitación no existe, ya fue usada o venció. Pide una nueva a la administración de la organización.
          </p>
          <Link href="/login" className="btn secondary block">
            Ir a iniciar sesión
          </Link>
        </Card>
      </main>
    );
  }

  const account = await getAccount();
  const next = encodeURIComponent(`/invitacion/${token}`);

  return (
    <OrgShell org={org}>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>Te invitaron a {org.displayName}</h1>
      <p style={{ color: "var(--ink-500)", fontSize: 13.5, marginBottom: 20, lineHeight: 1.55 }}>
        La invitación es para <b>{invitation.email}</b>, con acceso de {ROLE_LABEL[invitation.role]}.
      </p>
      {org.status !== "ACTIVE" ? (
        <OrgNotice tone="warn">
          La cuenta de esta organización está suspendida. Si tienes dudas, contacta a su administración.
        </OrgNotice>
      ) : !account ? (
        <div className="col" style={{ gap: 10 }}>
          <Link href={`/login?next=${next}`} className="btn primary lg block">
            Iniciar sesión para aceptar
          </Link>
          <Link
            href={`/register?next=${next}&email=${encodeURIComponent(invitation.email)}`}
            className="btn secondary lg block"
          >
            Crear mi cuenta
          </Link>
        </div>
      ) : account.email !== invitation.email ? (
        <div className="col" style={{ gap: 12 }}>
          <OrgNotice tone="warn">
            Entraste como {account.email}. Para aceptar, inicia sesión con {invitation.email}.
          </OrgNotice>
          <SwitchAccount next={`/invitacion/${token}`} />
        </div>
      ) : (
        <AcceptInvitation token={token} />
      )}
    </OrgShell>
  );
}
