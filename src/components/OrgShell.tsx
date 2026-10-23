import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { I } from "@/components/Icon";
import { Card, OrgBrand } from "@/components/ui-system";
import type { PublicOrganization } from "@/lib/public-org";

export function OrgShell({
  org,
  back,
  children,
}: {
  org: PublicOrganization;
  back?: string;
  children: ReactNode;
}) {
  const theme = org.brandColor ? ({ "--accent": org.brandColor } as CSSProperties) : undefined;
  return (
    <main
      className={org.brandColor ? "org-theme" : undefined}
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        alignContent: "center",
        gap: 16,
        background: "var(--bg)",
        padding: 24,
        ...theme,
      }}
    >
      <Card style={{ width: "100%", maxWidth: 460 }}>
        {back && (
          <Link
            href={back}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-500)", marginBottom: 18 }}
          >
            <I name="chevronLeft" size={16} /> Volver
          </Link>
        )}
        <div style={{ display: "flex", marginBottom: 22 }}>
          <OrgBrand name={org.displayName} logoUrl={org.logoUrl} />
        </div>
        {children}
      </Card>
      <p style={{ fontSize: 12, color: "var(--ink-500)", margin: 0 }}>
        Funciona con{" "}
        <Link href="/" style={{ fontWeight: 600, color: "var(--ink-700)" }}>
          S.I.G.T.E
        </Link>
      </p>
    </main>
  );
}

export function OrgNotice({ tone = "neutral", children }: { tone?: "neutral" | "warn"; children: ReactNode }) {
  return (
    <div
      style={{
        border: `1px solid ${tone === "warn" ? "var(--wait)" : "var(--line)"}`,
        background: tone === "warn" ? "var(--wait-050)" : "var(--surface-2)",
        borderRadius: "var(--r-md)",
        padding: "12px 14px",
        fontSize: 13.5,
        color: "var(--ink-700)",
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}
