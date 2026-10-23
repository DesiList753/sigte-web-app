import { requireTenantFeature } from "@/lib/auth";

export default async function UserInfractionsLayout({ children }: { children: React.ReactNode }) {
  await requireTenantFeature(["USER", "GUARD", "ADMIN"], "INFRACTIONS", "/user");
  return children;
}
