import type { PlanFeature } from "@prisma/client";
import { PanelShell, type PanelNavItem } from "@/components/PanelShell";
import { PlanProvider } from "@/components/PlanContext";
import { Toaster } from "@/components/ui/sonner";
import { requireTenantActor } from "@/lib/auth";
import { organizationOptions } from "@/lib/members";

const items: (PanelNavItem & { feature?: PlanFeature })[] = [
  { href: "/guard", label: "Control de acceso", icon: "barrier" },
  { href: "/guard/occupancy", label: "Estacionamiento", icon: "parking" },
  { href: "/guard/search", label: "Buscar vehículo", icon: "search" },
  { href: "/guard/infractions", label: "Infracciones", icon: "shieldAlert", feature: "INFRACTIONS" },
  { href: "/guard/history", label: "Historial", icon: "history" },
];

export default async function GuardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireTenantActor(["GUARD", "ADMIN"]);
  const features = session.plan.features;
  const organizations = await organizationOptions(session.sub);
  const groups = [{ grp: "Operación", items: items.filter((it) => !it.feature || features.includes(it.feature)) }];
  return (
    <PlanProvider features={features}>
      <PanelShell groups={groups} title="Guardia" subtitle="Operación de pórtico" brand={session.organization} organizations={organizations} currentOrganizationId={session.organizationId} userName={session.name} userRole="Guardia">
        {children}
      </PanelShell>
      <Toaster richColors position="top-right" />
    </PlanProvider>
  );
}
