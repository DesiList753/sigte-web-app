import { requireTenantFeature } from "@/lib/auth";

export default async function AdminInfractionsLayout({ children }: { children: React.ReactNode }) {
  await requireTenantFeature(["ADMIN"], "INFRACTIONS", "/admin");
  return children;
}
