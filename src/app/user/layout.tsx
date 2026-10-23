import { PortalShell, type PortalTab } from "@/components/PortalShell";
import { Toaster } from "@/components/ui/sonner";
import { requireTenantActor } from "@/lib/auth";

const tabs: PortalTab[] = [
  { href: "/user", label: "Inicio", icon: "home" },
  { href: "/user/vehicles", label: "Mis vehículos", icon: "car" },
  { href: "/user/qr", label: "QR de acceso", icon: "qr" },
  { href: "/user/access", label: "Mis accesos", icon: "history" },
  { href: "/user/infractions", label: "Infracciones", icon: "file" },
  { href: "/user/notifications", label: "Notificaciones", icon: "bell" },
];

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const session = await requireTenantActor(["USER", "GUARD", "ADMIN"]);
  return (
    <>
      <PortalShell tabs={tabs} userName={session.name}>{children}</PortalShell>
      <Toaster richColors position="top-right" />
    </>
  );
}
