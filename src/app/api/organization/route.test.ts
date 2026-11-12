import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/prisma", async () => {
  const { mockPrismaWithAudit } = await import("@/test/prisma");
  return {
    prisma: mockPrismaWithAudit({
      organization: {
        findUnique: vi.fn(),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...data })),
      },
    }),
  };
});

import { prisma } from "@/lib/prisma";
import { GET, PATCH } from "./route";
import { ORG_A, ORG_B, auditedIn, params, tenantRequest } from "@/test/tenant";

const current = {
  slug: "org-a-slug",
  name: "Organización A",
  displayName: "Org A",
  logoUrl: null,
  brandColor: null,
  registrationForm: "BASIC",
  joinPolicy: "OPEN",
  vehicleApproval: false,
  credentialsEnabled: false,
  allowedEmailDomains: [],
};

async function patch(body: Record<string, unknown>, role: "ADMIN" | "GUARD" | "USER" = "ADMIN") {
  return PATCH(await tenantRequest("/api/organization", { role }, { method: "PATCH", body }), params({}));
}

describe("GET /api/organization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(current as never);
  });

  it("entrega la configuración de la organización de la sesión", async () => {
    const res = await GET(await tenantRequest("/api/organization", { role: "ADMIN" }), params({}));
    expect(res.status).toBe(200);
    expect(prisma.organization.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: ORG_A } }));
  });

  it("indica si el plan permite activar las credenciales", async () => {
    const withPlan = await GET(await tenantRequest("/api/organization", { role: "ADMIN" }), params({}));
    expect((await withPlan.json()).credentialsAvailable).toBe(true);
    const withoutPlan = await GET(
      await tenantRequest("/api/organization", { role: "ADMIN", plan: { name: "Gratis", features: ["QR"] } }),
      params({})
    );
    expect((await withoutPlan.json()).credentialsAvailable).toBe(false);
  });

  it("no la entrega a un guardia", async () => {
    const res = await GET(await tenantRequest("/api/organization", { role: "GUARD" }), params({}));
    expect(res.status).toBe(403);
    expect(prisma.organization.findUnique).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/organization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(current as never);
  });

  it("el admin cambia el nombre visible, el logo y el color de su organización", async () => {
    const res = await patch({ displayName: "Mi campus", logoUrl: "https://cdn.test/logo.png", brandColor: "#0F766E" });
    expect(res.status).toBe(200);
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: ORG_A },
      data: { displayName: "Mi campus", logoUrl: "https://cdn.test/logo.png", brandColor: "#0F766E" },
      select: expect.any(Object),
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(auditedIn(ORG_A, "UPDATE", "ORGANIZATION"));
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ detail: { fields: ["displayName", "logoUrl", "brandColor"] } }),
    });
  });

  it("siempre edita la organización de la sesión aunque el envío nombre otra", async () => {
    await patch({ id: ORG_B, organizationId: ORG_B, displayName: "Otra" });
    expect(prisma.organization.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: ORG_A } }));
    expect(prisma.organization.findUnique).not.toHaveBeenCalledWith(expect.objectContaining({ where: { id: ORG_B } }));
  });

  it("no deja cambiar el slug, el nombre legal, el plan ni el estado", async () => {
    const res = await patch({ slug: "otro", name: "Otra legal", planId: "plan_institucional", status: "SUSPENDED" });
    expect(res.status).toBe(200);
    expect(prisma.organization.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("rechaza un color demasiado claro para texto blanco", async () => {
    const res = await patch({ brandColor: "#F7AE00" });
    expect(res.status).toBe(400);
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it("rechaza un logo que no sea https ni una ruta del sitio", async () => {
    const res = await patch({ logoUrl: "javascript:alert(1)" });
    expect(res.status).toBe(400);
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it("guarda los dominios en minúsculas y la forma de ingreso", async () => {
    await patch({ allowedEmailDomains: [" Organizacion.CL "], joinPolicy: "APPROVAL", vehicleApproval: true, registrationForm: "ACADEMIC" });
    expect(prisma.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          allowedEmailDomains: ["organizacion.cl"],
          joinPolicy: "APPROVAL",
          vehicleApproval: true,
          registrationForm: "ACADEMIC",
        },
      })
    );
  });

  it("activa las credenciales solo si el plan las incluye", async () => {
    await patch({ credentialsEnabled: true });
    expect(prisma.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ORG_A }, data: { credentialsEnabled: true } })
    );
    vi.mocked(prisma.organization.update).mockClear();
    const req = await tenantRequest(
      "/api/organization",
      { role: "ADMIN", plan: { name: "Gratis", features: ["QR"] } },
      { method: "PATCH", body: { credentialsEnabled: true } }
    );
    const res = await PATCH(req, params({}));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("PLAN_FEATURE");
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it("no registra auditoría si nada cambió", async () => {
    const res = await patch({ displayName: "Org A" });
    expect(res.status).toBe(200);
    expect(prisma.organization.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("solo el admin puede editar la organización", async () => {
    for (const role of ["GUARD", "USER"] as const) {
      const res = await patch({ brandColor: "#0F766E" }, role);
      expect(res.status).toBe(403);
    }
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });
});
