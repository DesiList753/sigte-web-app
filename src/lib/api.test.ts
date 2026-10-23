import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

import { loadActor } from "@/lib/actor";
import { signToken } from "@/lib/jwt";
import { withTenant } from "./api";
import { ORG_A, params, tenantRequest } from "@/test/tenant";

const handler = vi.fn(async (_req: NextRequest, ctx: { session: unknown }) =>
  NextResponse.json({ session: ctx.session })
);

describe("withTenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza una petición sin sesión", async () => {
    const res = await withTenant(handler)(new NextRequest("http://localhost/x"), params({}));
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("entrega al handler la organización de la base", async () => {
    const res = await withTenant(handler)(await tenantRequest("/x", { role: "ADMIN" }), params({}));
    expect(res.status).toBe(200);
    expect((await res.json()).session).toEqual({
      sub: "admin-a",
      email: "admin-a@test.cl",
      name: "admin-a",
      role: "ADMIN",
      organizationId: ORG_A,
    });
  });

  it("rechaza a un usuario desactivado", async () => {
    const res = await withTenant(handler)(await tenantRequest("/x", { role: "USER", active: false }), params({}));
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("rechaza si la organización está suspendida", async () => {
    const res = await withTenant(handler)(await tenantRequest("/x", { role: "ADMIN", status: "SUSPENDED" }), params({}));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("ORG_SUSPENDED");
    expect(handler).not.toHaveBeenCalled();
  });

  it("rechaza un token cuyo rol ya no coincide con la base", async () => {
    const req = await tenantRequest("/x", { role: "ADMIN" });
    vi.mocked(loadActor).mockResolvedValue({
      id: "admin-a",
      email: "admin-a@test.cl",
      name: "admin-a",
      role: "USER",
      active: true,
      organizationId: ORG_A,
      organization: { status: "ACTIVE" },
    });
    const res = await withTenant(handler)(req, params({}));
    expect(res.status).toBe(401);
  });

  it("rechaza a un SUPER_ADMIN en endpoints de organización", async () => {
    const token = await signToken({ sub: "root", email: "root@test.cl", role: "SUPER_ADMIN", name: "Root", organizationId: null });
    vi.mocked(loadActor).mockResolvedValue({
      id: "root",
      email: "root@test.cl",
      name: "Root",
      role: "SUPER_ADMIN",
      active: true,
      organizationId: null,
      organization: null,
    });
    const req = new NextRequest("http://localhost/x", { headers: { authorization: `Bearer ${token}` } });
    const res = await withTenant(handler)(req, params({}));
    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("aplica la restricción de roles", async () => {
    const res = await withTenant(handler, { roles: ["ADMIN"] })(await tenantRequest("/x", { role: "GUARD" }), params({}));
    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });
});
