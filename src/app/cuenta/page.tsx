import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, OrgBrand, ProductBrand } from "@/components/ui-system";
import { requireAccount } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EnterButton, JoinByCode, LogoutButton } from "./AccountActions";

export const metadata: Metadata = { title: "Mis organizaciones · S.I.G.T.E." };

const ROLE_LABEL = { USER: "Usuario", GUARD: "Guardia", ADMIN: "Administrador", SUPER_ADMIN: "Plataforma" };

export default async function AccountPage() {
  const account = await requireAccount();
  const memberships = await prisma.membership.findMany({
    where: { userId: account.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      status: true,
      active: true,
      organization: {
        select: { id: true, slug: true, name: true, displayName: true, logoUrl: true, status: true },
      },
    },
  });

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", padding: 24 }}>
      <div style={{ maxWidth: 640, margin: "0 auto", display: "grid", gap: 16 }}>
        <div className="row between" style={{ gap: 12, flexWrap: "wrap" }}>
          <ProductBrand />
          <LogoutButton />
        </div>

        <div>
          <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 24 }}>Mis organizaciones</h1>
          <p className="muted" style={{ fontSize: 13.5 }}>
            {account.name} · {account.email}
          </p>
        </div>

        <Card>
          {memberships.length === 0 ? (
            <p className="muted" style={{ fontSize: 13.5, margin: 0, lineHeight: 1.55 }}>
              Todavía no perteneces a ninguna organización. Únete con su código o con la invitación que te envió
              su administración.
            </p>
          ) : (
            <div style={{ display: "grid" }}>
              {memberships.map((m, i) => {
                const org = m.organization;
                const canEnter = m.status === "ACTIVE" && m.active && org.status === "ACTIVE";
                return (
                  <div
                    key={m.id}
                    className="row between"
                    style={{
                      gap: 12,
                      flexWrap: "wrap",
                      padding: "14px 0",
                      borderTop: i === 0 ? "none" : "1px solid var(--line)",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: "1 1 220px" }}>
                      <OrgBrand name={org.displayName} legalName={org.name} logoUrl={org.logoUrl} />
                    </div>
                    {canEnter ? (
                      <span className="row" style={{ gap: 10 }}>
                        <span className="muted" style={{ fontSize: 12.5 }}>{ROLE_LABEL[m.role]}</span>
                        <EnterButton organizationId={org.id} />
                      </span>
                    ) : m.status === "PENDING" ? (
                      <Badge kind="wait">Esperando aprobación</Badge>
                    ) : m.status === "REJECTED" ? (
                      <span className="row" style={{ gap: 10 }}>
                        <Badge kind="no">Solicitud rechazada</Badge>
                        <Link href={`/cuenta/unirse/${org.slug}`} style={{ fontSize: 13, fontWeight: 600 }}>
                          Volver a solicitar
                        </Link>
                      </span>
                    ) : org.status !== "ACTIVE" ? (
                      <Badge kind="neutral">Organización suspendida</Badge>
                    ) : (
                      <Badge kind="neutral">Acceso desactivado</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Unirme a una organización">
          <JoinByCode />
        </Card>
      </div>
    </main>
  );
}
