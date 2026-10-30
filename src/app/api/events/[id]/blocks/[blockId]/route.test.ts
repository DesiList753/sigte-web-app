import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/prisma", async () => {
  const { mockPrismaWithAudit } = await import("@/test/prisma");
  return {
    prisma: mockPrismaWithAudit({
      parkingEvent: { findFirst: vi.fn() },
      parkingEventBlock: {
        update: vi.fn().mockResolvedValue({}),
        findMany: vi.fn().mockResolvedValue([
          { releasedAt: new Date(), block: { id: "block-a", name: "Estacionamiento 3" } },
          { releasedAt: null, block: { id: "block-b", name: "Estacionamiento 4" } },
        ]),
      },
      membership: { findMany: vi.fn().mockResolvedValue([{ userId: "u-1" }]) },
      vehicle: { findMany: vi.fn().mockResolvedValue([]) },
      notification: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    }),
  };
});

import { prisma } from "@/lib/prisma";
import { PATCH } from "./route";
import { ORG_A, ORG_B, auditedIn, onlyInOrg, params, tenantRequest } from "@/test/tenant";

const eventA = {
  id: "ev-a",
  organizationId: ORG_A,
  title: "Exposición",
  description: "Feria anual",
  kind: "EVENT",
  status: "ACTIVE",
  disableEntry: true,
  audience: "ALL",
  startsAt: new Date(Date.now() - 3600_000),
  endsAt: null,
  blocks: [
    { releasedAt: null, block: { id: "block-a", name: "Estacionamiento 3" } },
    { releasedAt: null, block: { id: "block-b", name: "Estacionamiento 4" } },
  ],
};

const path = "/api/events/ev-a/blocks/block-a";

describe("PATCH /api/events/[id]/blocks/[blockId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.parkingEvent.findFirst).mockImplementation(onlyInOrg(ORG_A, eventA));
  });

  it("un ADMIN de otra organización no puede liberar bloques del evento", async () => {
    const req = await tenantRequest(path, { role: "ADMIN", organizationId: ORG_B }, { method: "PATCH", body: { released: true } });
    const res = await PATCH(req, params({ id: "ev-a", blockId: "block-a" }));
    expect(res.status).toBe(404);
    expect(prisma.parkingEventBlock.update).not.toHaveBeenCalled();
  });

  it("un GUARD no puede liberar bloques", async () => {
    const req = await tenantRequest(path, { role: "GUARD" }, { method: "PATCH", body: { released: true } });
    const res = await PATCH(req, params({ id: "ev-a", blockId: "block-a" }));
    expect(res.status).toBe(403);
    expect(prisma.parkingEventBlock.update).not.toHaveBeenCalled();
  });

  it("rechaza un bloque que no es parte del evento", async () => {
    const req = await tenantRequest("/api/events/ev-a/blocks/block-x", { role: "ADMIN" }, { method: "PATCH", body: { released: true } });
    const res = await PATCH(req, params({ id: "ev-a", blockId: "block-x" }));
    expect(res.status).toBe(404);
  });

  it("libera un bloque con el evento en curso, notifica y audita REACTIVATE", async () => {
    const req = await tenantRequest(path, { role: "ADMIN" }, { method: "PATCH", body: { released: true, notify: true } });
    const res = await PATCH(req, params({ id: "ev-a", blockId: "block-a" }));
    expect(res.status).toBe(200);
    expect(prisma.parkingEventBlock.update).toHaveBeenCalledWith({
      where: { eventId_blockId: { eventId: "ev-a", blockId: "block-a" } },
      data: { releasedAt: expect.any(Date) },
    });
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ organizationId: ORG_A, userId: "u-1", eventId: "ev-a" })],
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(auditedIn(ORG_A, "REACTIVATE", "EVENT"));
    const body = await res.json();
    expect(body.event.blocks).toEqual([
      { id: "block-a", name: "Estacionamiento 3", released: true },
      { id: "block-b", name: "Estacionamiento 4", released: false },
    ]);
  });

  it("vuelve a cerrar un bloque liberado y audita SUSPEND", async () => {
    vi.mocked(prisma.parkingEvent.findFirst).mockImplementation(
      onlyInOrg(ORG_A, {
        ...eventA,
        blocks: [{ releasedAt: new Date(), block: { id: "block-a", name: "Estacionamiento 3" } }],
      })
    );
    const req = await tenantRequest(path, { role: "ADMIN" }, { method: "PATCH", body: { released: false } });
    const res = await PATCH(req, params({ id: "ev-a", blockId: "block-a" }));
    expect(res.status).toBe(200);
    expect(prisma.parkingEventBlock.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { releasedAt: null } })
    );
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(auditedIn(ORG_A, "SUSPEND", "EVENT"));
  });

  it("no permite cambiar bloques de un evento finalizado", async () => {
    vi.mocked(prisma.parkingEvent.findFirst).mockImplementation(onlyInOrg(ORG_A, { ...eventA, status: "ENDED" }));
    const req = await tenantRequest(path, { role: "ADMIN" }, { method: "PATCH", body: { released: true } });
    const res = await PATCH(req, params({ id: "ev-a", blockId: "block-a" }));
    expect(res.status).toBe(409);
    expect(prisma.parkingEventBlock.update).not.toHaveBeenCalled();
  });
});
