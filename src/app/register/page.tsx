import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FindOrganization } from "./FindOrganization";

export const metadata: Metadata = { title: "Crear cuenta · S.I.G.T.E" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string | string[] }>;
}) {
  const { org } = await searchParams;
  if (typeof org === "string" && org) redirect(`/o/${encodeURIComponent(org)}/registro`);
  return <FindOrganization />;
}
