import { NextRequest } from "next/server";
import { expect, vi } from "vitest";
import type { OrganizationStatus } from "@prisma/client";
import { loadActor } from "@/lib/actor";
import { signToken } from "@/lib/jwt";
import type { TenantRole } from "@/lib/auth";

export const ORG_A = "org-a";
export const ORG_B = "org-b";

type As = {
  role: TenantRole;
  sub?: string;
  organizationId?: string;
  status?: OrganizationStatus;
  active?: boolean;
};

export async function tenantRequest(
  path: string,
  as: As,
  init: { method?: string; body?: unknown } = {}
) {
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
    organization: { status: as.status ?? "ACTIVE" },
  });
  const token = await signToken({ sub, email, role: as.role, name: sub, organizationId });
  const headers: Record<string, string> = { authorization: `Bearer ${token}` };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  return new NextRequest(`http://localhost${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

export function params<T>(value: T) {
  return { params: Promise.resolve(value) };
}

export function onlyInOrg<T>(organizationId: string, record: T) {
  return (async (args?: { where?: { organizationId?: string } }) =>
    args?.where?.organizationId === organizationId ? record : null) as never;
}

export function scopedTo(organizationId: string) {
  return expect.objectContaining({ where: expect.objectContaining({ organizationId }) });
}
