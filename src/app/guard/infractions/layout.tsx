import { requireTenantFeature } from "@/lib/auth";

export default async function GuardInfractionsLayout({ children }: { children: React.ReactNode }) {
  await requireTenantFeature(["GUARD", "ADMIN"], "INFRACTIONS", "/guard");
  return children;
}
