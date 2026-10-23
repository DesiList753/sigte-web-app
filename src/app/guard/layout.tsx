import { PanelShell, type PanelNavGroup } from "@/components/PanelShell";
import { Toaster } from "@/components/ui/sonner";
import { requireTenantActor } from "@/lib/auth";

const groups: PanelNavGroup[] = [
  { grp: "Operación", items: [
    { href: "/guard", label: "Control de acceso", icon: "barrier" },
    { href: "/guard/occupancy", label: "Estacionamiento", icon: "parking" },
    { href: "/guard/search", label: "Buscar vehículo", icon: "search" },
    { href: "/guard/infractions", label: "Infracciones", icon: "shieldAlert" },
    { href: "/guard/history", label: "Historial", icon: "history" },
  ] },
];

export default async function GuardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireTenantActor(["GUARD", "ADMIN"]);
  return (
    <>
      <PanelShell groups={groups} title="Guardia" subtitle="Operación de pórtico" userName={session.name} userRole="Guardia">
        {children}
      </PanelShell>
      <Toaster richColors position="top-right" />
    </>
  );
}
