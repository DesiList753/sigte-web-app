"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { I } from "@/components/Icon";
import { OrgBrand, ProductBrand } from "@/components/ui-system";
import { OrgSwitcher, type OrgOption } from "@/components/OrgSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { OrganizationBrand } from "@/lib/auth";
import { orgTheme } from "@/lib/theme";

export interface PanelNavItem { href: string; label: string; icon: string; }
export interface PanelNavGroup { grp: string; items: PanelNavItem[]; }

function Sidebar({ groups, brand, open, onClose }: { groups: PanelNavGroup[]; brand?: OrganizationBrand; open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const activeHref = groups
    .flatMap((g) => g.items)
    .filter((it) => pathname === it.href || pathname.startsWith(it.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }
  return (
    <aside className={"panel-sidebar" + (open ? " open" : "")} style={{ width: 244, background: "var(--accent-900)", color: "#fff", display: "flex", flexDirection: "column", flex: "none" }}>
      <Link href="/" onClick={onClose} style={{ padding: "18px 18px 16px", borderBottom: "1px solid rgba(255,255,255,.1)", color: "inherit" }}>
        {brand ? (
          <OrgBrand name={brand.displayName} legalName={brand.name} logoUrl={brand.logoUrl} light />
        ) : (
          <ProductBrand light />
        )}
      </Link>
      <nav style={{ flex: 1, overflowY: "auto", padding: "14px 12px" }}>
        {groups.map((g) => (
          <div key={g.grp} style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: "var(--ff-display)", fontSize: 10.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.6)", padding: "0 10px 7px" }}>{g.grp}</div>
            {g.items.map((it) => {
              const on = it.href === activeHref;
              return (
                <Link key={it.href} href={it.href} onClick={onClose} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 10px", marginBottom: 2, borderRadius: 8, background: on ? "rgba(255,255,255,.14)" : "transparent", color: on ? "#fff" : "rgba(255,255,255,.78)", fontFamily: "var(--ff-body)", fontSize: 13.5, fontWeight: on ? 600 : 400 }}>
                  <I name={it.icon} size={18} stroke={1.9} />
                  <span style={{ flex: 1 }}>{it.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <button onClick={logout} style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 22px", border: "none", borderTop: "1px solid rgba(255,255,255,.1)", background: "transparent", color: "rgba(255,255,255,.7)", cursor: "pointer", fontFamily: "var(--ff-body)", fontSize: 13 }}>
        <I name="logout" size={17} /> Cerrar sesión
      </button>
    </aside>
  );
}

function TopBar({ title, subtitle, userName, userRole, organizations, currentOrganizationId, onBurger }: { title: string; subtitle: string; userName: string; userRole: string; organizations?: OrgOption[]; currentOrganizationId?: string; onBurger: () => void }) {
  const ini = userName.split(/[\s.]/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <header style={{ height: 62, flex: "none", background: "var(--surface)", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 16, padding: "0 16px" }}>
      <button className="panel-burger" onClick={onBurger} aria-label="Abrir menú">
        <I name="menu" size={22} />
      </button>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: "var(--ff-display)", fontWeight: 700, fontSize: 19, lineHeight: 1.1 }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 1 }}>{subtitle}</div>
      </div>
      <div style={{ flex: 1 }} />
      {organizations && currentOrganizationId && <OrgSwitcher options={organizations} current={currentOrganizationId} />}
      <ThemeToggle />
      <div style={{ display: "flex", alignItems: "center", gap: 9, paddingLeft: 6, borderLeft: "1px solid var(--line)" }}>
        <span className="avatar">{ini || "…"}</span>
        <div style={{ lineHeight: 1.15 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{userName}</div>
          <div style={{ fontSize: 11, color: "var(--ink-500)" }}>{userRole}</div>
        </div>
      </div>
    </header>
  );
}

export function PanelShell({ groups, title, subtitle, userName, userRole, brand, organizations, currentOrganizationId, children }: {
  groups: PanelNavGroup[]; title: string; subtitle: string; userName: string; userRole: string; brand?: OrganizationBrand; organizations?: OrgOption[]; currentOrganizationId?: string; children: ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const theme = orgTheme(brand?.brandColor);
  return (
    <div className={theme.className} style={{ height: "100vh", display: "flex", ...theme.style }}>
      <Sidebar groups={groups} brand={brand} open={navOpen} onClose={() => setNavOpen(false)} />
      {navOpen && <div className="panel-overlay" onClick={() => setNavOpen(false)} />}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <TopBar title={title} subtitle={subtitle} userName={userName} userRole={userRole} organizations={organizations} currentOrganizationId={currentOrganizationId} onBurger={() => setNavOpen(true)} />
        <main style={{ flex: 1, overflowY: "auto", background: "var(--bg)" }}>{children}</main>
      </div>
    </div>
  );
}
