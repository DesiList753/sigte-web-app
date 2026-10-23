import { requireTenantFeature } from "@/lib/auth";

export default async function UserQrLayout({ children }: { children: React.ReactNode }) {
  await requireTenantFeature(["USER", "GUARD", "ADMIN"], "QR", "/user");
  return children;
}
