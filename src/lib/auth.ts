import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { cache } from "react";
import type { PlanFeature, Role } from "@prisma/client";
import { COOKIE_NAME, verifyToken, type SessionPayload } from "./jwt";
import { loadActor, type Actor } from "./actor";
import type { PlanInfo } from "./plan";

export type TenantRole = Exclude<Role, "SUPER_ADMIN">;

export type OrganizationBrand = {
  slug: string;
  name: string;
  displayName: string;
  logoUrl: string | null;
  brandColor: string | null;
};

export type TenantSession = {
  sub: string;
  email: string;
  name: string;
  role: TenantRole;
  organizationId: string;
  organization: OrganizationBrand;
  plan: PlanInfo;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  const isProduction = process.env.NODE_ENV === "production";
  const isDevTunnel =
    !!process.env.DEVTUNNEL_URL || process.env.HOST?.includes("devtunnels");
  const isSecure = isProduction || isDevTunnel;
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  const isProduction = process.env.NODE_ENV === "production";
  const isDevTunnel =
    !!process.env.DEVTUNNEL_URL || process.env.HOST?.includes("devtunnels");
  const isSecure = isProduction || isDevTunnel;
  jar.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
    maxAge: 0,
  });
  jar.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function getSessionFromRequest(
  req: NextRequest
): Promise<SessionPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function resolveActor(session: SessionPayload | null) {
  if (!session) return null;
  const actor = await loadActor(session.sub, session.organizationId);
  if (!actor?.active || actor.role !== session.role) return null;
  return actor;
}

export function asTenant(actor: Actor): TenantSession | null {
  const org = actor.organization;
  if (actor.role === "SUPER_ADMIN" || !actor.organizationId || !org) return null;
  return {
    sub: actor.id,
    email: actor.email,
    name: actor.name,
    role: actor.role,
    organizationId: actor.organizationId,
    organization: {
      slug: org.slug,
      name: org.name,
      displayName: org.displayName,
      logoUrl: org.logoUrl,
      brandColor: org.brandColor,
    },
    plan: org.plan,
  };
}

export function homePath(role: Role) {
  if (role === "SUPER_ADMIN") return "/platform";
  if (role === "ADMIN") return "/admin";
  if (role === "GUARD") return "/guard";
  return "/user";
}

export const getActor = cache(async () => resolveActor(await getSession()));

export async function requirePlatformActor() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (actor.role !== "SUPER_ADMIN") redirect(homePath(actor.role));
  return actor;
}

export async function requireTenantActor(roles: TenantRole[]) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const tenant = asTenant(actor);
  if (!tenant) redirect(homePath(actor.role));
  if (actor.organization?.status !== "ACTIVE") redirect("/suspendida");
  if (!roles.includes(tenant.role)) redirect(homePath(tenant.role));
  return tenant;
}

export async function requireTenantFeature(roles: TenantRole[], feature: PlanFeature, fallback: string) {
  const tenant = await requireTenantActor(roles);
  if (!tenant.plan.features.includes(feature)) redirect(fallback);
  return tenant;
}
