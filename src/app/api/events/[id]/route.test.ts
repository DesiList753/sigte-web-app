import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/prisma", async () => {
  const { mockPrismaWithAudit } = await import("@/test/prisma");
  return {
    prisma: mockPrismaWithAudit({
      parkingEvent: {
        findFirst: vi.fn(),
        update: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: "ev-a",
            title: "Exposición",
            description: "Feria anual",
            kind: "EVENT",
            status: data.status ?? "ACTIVE",
            startsAt: new Date("2026-10-28T10:00:00Z"),
            endsAt: null,
            blocks: [{ block: { id: "block-a", name: "Estacionamiento 3" } }],
            ...data,
          })
        ),
        delete: vi.fn().mockResolvedValue({}),
      },
      parkingEventBlock: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      parkingBlock: {
        findMany: vi.fn().mockResolvedValue([{ id: "block-a", name: "Estacionamiento 3" }]),
      },
      membership: {
        findMany: vi.fn().mockResolvedValue([{ userId: "u-1" }]),
      },
      vehicle: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      notification: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    }),
  };
});

import { prisma } from "@/lib/prisma";
import { DELETE, PATCH } from "./route";
import { ORG_A, ORG_B, auditedIn, onlyInOrg, params, tenantRequest } from "@/test/tenant";

const eventA = {
  id: "ev-a",
  organizationId: ORG_A,
  title: "Exposición",
  description: "Feria anual",
  kind: "EVENT",
  status: "ACTIVE",
  disableEntry: true,
  showBanner: true,
  audience: "ALL",
  startsAt: new Date("2026-10-28T10:00:00Z"),
  endsAt: null,
  endedAt: null,
  blocks: [{ block: { id: "block-a", name: "Estacionamiento 3" } }],
};

describe("PATCH /api/events/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.parkingEvent.findFirst).mockImplementation(onlyInOrg(ORG_A, eventA));
  });

  it("un ADMIN de otra organización no puede editar ni finalizar el evento", async () => {
    const req = await tenantRequest(
      "/api/events/ev-a",
      { role: "ADMIN", organizationId: ORG_B },
      { method: "PATCH", body: { status: "ENDED" } }
    );
    const res = await PATCH(req, params({ id: "ev-a" }));
    expect(res.status).toBe(404);
    expect(prisma.parkingEvent.update).not.toHaveBeenCalled();
  });

  it("finaliza el evento, envía aviso de reapertura si se solicita y audita RESOLVE", async () => {
    const req = await tenantRequest(
      "/api/events/ev-a",
      { role: "ADMIN" },
      { method: "PATCH", body: { status: "ENDED", notifyUpdate: true } }
    );
    const res = await PATCH(req, params({ id: "ev-a" }));
    expect(res.status).toBe(200);
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          organizationId: ORG_A,
          userId: "u-1",
          kind: "NOTICE",
        }),
      ],
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(auditedIn(ORG_A, "RESOLVE", "EVENT"));
  });
});

describe("DELETE /api/events/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.parkingEvent.findFirst).mockImplementation(onlyInOrg(ORG_A, eventA));
  });

  it("un ADMIN de otra organización no puede eliminar el evento", async () => {
    const req = await tenantRequest(
      "/api/events/ev-a",
      { role: "ADMIN", organizationId: ORG_B },
      { method: "DELETE" }
    );
    const res = await DELETE(req, params({ id: "ev-a" }));
    expect(res.status).toBe(404);
    expect(prisma.parkingEvent.delete).not.toHaveBeenCalled();
  });

  it("elimina el evento de su organización y registra auditoría", async () => {
    const req = await tenantRequest(
      "/api/events/ev-a",
      { role: "ADMIN" },
      { method: "DELETE" }
    );
    const res = await DELETE(req, params({ id: "ev-a" }));
    expect(res.status).toBe(200);
    expect(prisma.parkingEvent.delete).toHaveBeenCalledWith({ where: { id: "ev-a" } });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(auditedIn(ORG_A, "DELETE", "EVENT"));
  });
});
