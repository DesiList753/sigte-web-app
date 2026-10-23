import { NextRequest } from "next/server";
import { expect, vi } from "vitest";
import type { OrganizationStatus } from "@prisma/client";
import { loadActor } from "@/lib/actor";
import { COOKIE_NAME, signToken } from "@/lib/jwt";
import type { TenantRole } from "@/lib/auth";
import type { PlanInfo } from "@/lib/plan";

export const ORG_A = "org-a";
export const ORG_B = "org-b";

export const ORG_BRAND = {
  slug: "org-a-slug",
  name: "Organización A",
  displayName: "Org A",
  logoUrl: null,
  brandColor: null,
};

export const FULL_PLAN: PlanInfo = {
  name: "Prueba",
  features: ["QR", "INFRACTIONS", "REPORTS"],
  maxUsers: null,
  maxGuards: null,
  maxBlocks: null,
  maxVehicles: null,
};

type As = {
  role: TenantRole;
  sub?: string;
  organizationId?: string;
  status?: OrganizationStatus;
  active?: boolean;
  plan?: Partial<PlanInfo>;
};

type Init = { method?: string; body?: unknown };

function build(path: string, token: string, init: Init) {
  const headers: Record<string, string> = { cookie: `${COOKIE_NAME}=${token}` };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  return new NextRequest(`http://localhost${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

export async function tenantRequest(path: string, as: As, init: Init = {}) {
  const sub = as.sub ?? `${as.role.toLowerCase()}-a`;
  const organizationId = as.organizationId ?? ORG_A;
  const email = `${sub}@test.cl`;
  vi.mocked(loadActor).mockResolvedValue({
    id: sub,
    email,
    name: sub,
    role: as.role,
    active: as.active ?? true,
    organizationId,
    organization: { status: as.status ?? "ACTIVE", ...ORG_BRAND, plan: { ...FULL_PLAN, ...as.plan } },
  });
  const token = await signToken({ sub, email, role: as.role, name: sub, organizationId });
  return build(path, token, init);
}

export async function platformRequest(path: string, init: Init = {}) {
  vi.mocked(loadActor).mockResolvedValue({
    id: "root",
    email: "root@vanillasoft.test",
    name: "Equipo VanillaSoft",
    role: "SUPER_ADMIN",
    active: true,
    organizationId: null,
    organization: null,
  });
  const token = await signToken({
    sub: "root",
    email: "root@vanillasoft.test",
    role: "SUPER_ADMIN",
    name: "Equipo VanillaSoft",
    organizationId: null,
  });
  return build(path, token, init);
}

export function params<T>(value: T) {
  return { params: Promise.resolve(value) };
}

export function onlyInOrg<T>(organizationId: string, record: T) {
  return (async (args?: { where?: { organizationId?: string } }) =>
    args?.where?.organizationId === organizationId ? record : null) as never;
}

export function onlyMemberOf<T>(organizationId: string, record: T) {
  return (async (args?: { where?: { userId_organizationId?: { organizationId?: string } } }) =>
    args?.where?.userId_organizationId?.organizationId === organizationId ? record : null) as never;
}

export function scopedTo(organizationId: string) {
  return expect.objectContaining({ where: expect.objectContaining({ organizationId }) });
}

export function auditedIn(organizationId: string, action: string, entity: string) {
  return expect.objectContaining({
    data: expect.objectContaining({ organizationId, action, entity }),
  });
}
