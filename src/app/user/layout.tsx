import type { PlanFeature } from "@prisma/client";
import { PortalShell, type PortalTab } from "@/components/PortalShell";
import { PlanProvider } from "@/components/PlanContext";
import { Toaster } from "@/components/ui/sonner";
import { requireTenantActor } from "@/lib/auth";
import { organizationOptions } from "@/lib/members";

const tabs: (PortalTab & { feature?: PlanFeature })[] = [
  { href: "/user", label: "Inicio", icon: "home" },
  { href: "/user/vehicles", label: "Mis vehículos", icon: "car" },
  { href: "/user/qr", label: "QR de acceso", icon: "qr", feature: "QR" },
  { href: "/user/access", label: "Mis accesos", icon: "history" },
  { href: "/user/infractions", label: "Infracciones", icon: "file", feature: "INFRACTIONS" },
  { href: "/user/notifications", label: "Notificaciones", icon: "bell" },
];

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const session = await requireTenantActor(["USER", "GUARD", "ADMIN"]);
  const features = session.plan.features;
  const organizations = await organizationOptions(session.sub);
  return (
    <PlanProvider features={features}>
      <PortalShell tabs={tabs.filter((t) => !t.feature || features.includes(t.feature))} userName={session.name} brand={session.organization} organizations={organizations} currentOrganizationId={session.organizationId}>
        {children}
      </PortalShell>
      <Toaster richColors position="top-right" />
    </PlanProvider>
  );
}
