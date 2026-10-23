import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { I } from "@/components/Icon";
import { OrgNotice, OrgShell } from "@/components/OrgShell";
import { publicOrganization } from "@/lib/public-org";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const org = await publicOrganization((await params).slug);
  return { title: org ? `${org.displayName} · S.I.G.T.E` : "S.I.G.T.E" };
}

export default async function OrganizationPage({ params }: Props) {
  const org = await publicOrganization((await params).slug);
  if (!org) notFound();

  return (
    <OrgShell org={org}>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>Acceso vehicular</h1>
      <p style={{ color: "var(--ink-500)", fontSize: 13.5, marginBottom: 20, lineHeight: 1.55 }}>
        Entra con tu cuenta de {org.displayName} para ver tus vehículos, tus accesos y tu código QR.
      </p>
      {org.status !== "ACTIVE" ? (
        <OrgNotice tone="warn">
          La cuenta de esta organización está suspendida. Si tienes dudas, contacta a su administración.
        </OrgNotice>
      ) : (
        <div className="col" style={{ gap: 10 }}>
          <Link href={`/o/${org.slug}/login`} className="btn primary lg block">
            <I name="login" size={19} /> Iniciar sesión
          </Link>
          {org.selfRegistration ? (
            <Link href={`/o/${org.slug}/registro`} className="btn secondary lg block">
              <I name="userCheck" size={19} /> Crear mi cuenta
            </Link>
          ) : (
            <OrgNotice>Las cuentas nuevas las crea la administración de {org.displayName}.</OrgNotice>
          )}
        </div>
      )}
    </OrgShell>
  );
}
