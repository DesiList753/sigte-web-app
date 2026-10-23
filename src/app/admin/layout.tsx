import type { PlanFeature } from "@prisma/client";
import { PanelShell, type PanelNavItem } from "@/components/PanelShell";
import { PlanProvider } from "@/components/PlanContext";
import { Toaster } from "@/components/ui/sonner";
import { requireTenantActor } from "@/lib/auth";
import { organizationOptions } from "@/lib/members";

const items: (PanelNavItem & { feature?: PlanFeature })[] = [
  { href: "/admin", label: "Panel", icon: "dashboard" },
  { href: "/admin/users", label: "Usuarios", icon: "users" },
  { href: "/admin/vehicles", label: "Vehículos", icon: "car" },
  { href: "/admin/parking", label: "Bloques", icon: "parking" },
  { href: "/admin/access", label: "Accesos", icon: "history" },
  { href: "/admin/infractions", label: "Infracciones", icon: "shieldAlert", feature: "INFRACTIONS" },
  { href: "/admin/audit", label: "Auditoría", icon: "list" },
  { href: "/admin/configuracion", label: "Configuración", icon: "sliders" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireTenantActor(["ADMIN"]);
  const features = session.plan.features;
  const organizations = await organizationOptions(session.sub);
  const groups = [{ grp: "Administración", items: items.filter((it) => !it.feature || features.includes(it.feature)) }];
  return (
    <PlanProvider features={features}>
      <PanelShell groups={groups} title="Administración" subtitle="Vista de mando" brand={session.organization} organizations={organizations} currentOrganizationId={session.organizationId} userName={session.name} userRole="Administración">
        {children}
      </PanelShell>
      <Toaster richColors position="top-right" />
    </PlanProvider>
  );
}
