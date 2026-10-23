import { PanelShell, type PanelNavGroup } from "@/components/PanelShell";
import { Toaster } from "@/components/ui/sonner";
import { requirePlatformActor } from "@/lib/auth";

const groups: PanelNavGroup[] = [
  { grp: "Plataforma", items: [
    { href: "/platform", label: "Organizaciones", icon: "list" },
    { href: "/platform/plans", label: "Planes", icon: "sliders" },
    { href: "/platform/audit", label: "Auditoría", icon: "history" },
  ] },
];

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePlatformActor();
  return (
    <>
      <PanelShell groups={groups} title="Plataforma" subtitle="VanillaSoft" userName={actor.name} userRole="Plataforma">
        {children}
      </PanelShell>
      <Toaster richColors position="top-right" />
    </>
  );
}
