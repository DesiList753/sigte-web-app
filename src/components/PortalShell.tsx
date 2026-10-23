"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode } from "react";
import { I } from "@/components/Icon";
import { OrgBrand } from "@/components/ui-system";
import { OrgSwitcher, type OrgOption } from "@/components/OrgSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { OrganizationBrand } from "@/lib/auth";
import { orgTheme } from "@/lib/theme";

export interface PortalTab { href: string; label: string; icon: string; }

export function PortalShell({ tabs, userName, brand, organizations, currentOrganizationId, children }: { tabs: PortalTab[]; userName: string; brand: OrganizationBrand; organizations: OrgOption[]; currentOrganizationId: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const ini = userName.split(/[\s.]/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }
  const activeHref = tabs
    .filter((t) => pathname === t.href || pathname.startsWith(t.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const theme = orgTheme(brand.brandColor);
  return (
    <div className={theme.className} style={{ minHeight: "100vh", background: "var(--bg)", ...theme.style }}>
      <header style={{ background: "var(--surface)", borderBottom: "1px solid var(--line)", position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: 920, margin: "0 auto", padding: "0 24px", height: 60, display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/user" className="portal-brand" style={{ minWidth: 0 }}>
            <OrgBrand name={brand.displayName} legalName={brand.name} logoUrl={brand.logoUrl} />
          </Link>
          <div style={{ flex: 1 }} />
          <OrgSwitcher options={organizations} current={currentOrganizationId} />
          <ThemeToggle />
          <span className="avatar">{ini || "…"}</span>
          <button className="btn ghost icon" onClick={logout} title="Cerrar sesión"><I name="logout" size={18} /></button>
        </div>
        <nav style={{ maxWidth: 920, margin: "0 auto", padding: "0 24px", display: "flex", gap: 4, overflowX: "auto" }}>
          {tabs.map((t) => {
            const on = t.href === activeHref;
            return (
              <Link key={t.href} href={t.href} style={{ display: "flex", alignItems: "center", gap: 7, padding: "11px 12px", flex: "none", whiteSpace: "nowrap", fontSize: 13.5, fontWeight: on ? 600 : 500, color: on ? "var(--accent)" : "var(--ink-500)", borderBottom: on ? "2px solid var(--accent)" : "2px solid transparent" }}>
                <I name={t.icon} size={17} /> {t.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main style={{ maxWidth: 920, margin: "0 auto", padding: 24 }}>{children}</main>
    </div>
  );
}
