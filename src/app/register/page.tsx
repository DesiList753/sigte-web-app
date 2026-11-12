import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ACCOUNT_HOME, getAccount } from "@/lib/auth";
import { AccountForm } from "./AccountForm";

export const metadata: Metadata = { title: "Crear cuenta · S.I.G.T.E." };

function safeNext(next: string | string[] | undefined) {
  return typeof next === "string" && /^\/(?![/\\])/.test(next) ? next : null;
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string | string[]; next?: string | string[]; email?: string | string[] }>;
}) {
  const { org, next, email } = await searchParams;
  if (typeof org === "string" && org) redirect(`/o/${encodeURIComponent(org)}/registro`);
  const target = safeNext(next);
  if (await getAccount()) redirect(target ?? ACCOUNT_HOME);
  return <AccountForm next={target} email={typeof email === "string" ? email : ""} />;
}
