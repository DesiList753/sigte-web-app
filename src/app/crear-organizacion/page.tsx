import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { I } from "@/components/Icon";
import { Card, ProductBrand } from "@/components/ui-system";
import { getActor, homePath } from "@/lib/auth";
import { SIGNUP_PLAN } from "@/lib/organizations";
import { prisma } from "@/lib/prisma";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Crear cuenta para mi organización · S.I.G.T.E" };

export default async function CreateOrganizationPage() {
  const actor = await getActor();
  if (actor) redirect(homePath(actor.role));
  const plan = await prisma.plan.findUnique({ where: { code: SIGNUP_PLAN }, select: { name: true } });

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", padding: 24 }}>
      <Card style={{ width: "100%", maxWidth: 480 }}>
        <Link
          href="/"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-500)", marginBottom: 18 }}
        >
          <I name="chevronLeft" size={16} /> Volver al inicio
        </Link>
        <div style={{ display: "flex", marginBottom: 22 }}>
          <ProductBrand />
        </div>
        <h1 style={{ fontSize: 22, marginBottom: 6 }}>Crear cuenta para mi organización</h1>
        <p style={{ color: "var(--ink-500)", fontSize: 13.5, marginBottom: 20, lineHeight: 1.55 }}>
          Quedarás como administrador.{plan && ` La cuenta parte en el plan ${plan.name}.`}{" "}
          <Link href="/#planes" style={{ fontWeight: 600 }}>
            Ver planes
          </Link>
        </p>
        <SignupForm />
      </Card>
    </main>
  );
}
