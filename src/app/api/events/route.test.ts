import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/actor", () => ({ loadActor: vi.fn() }));

vi.mock("@/lib/prisma", async () => {
  const { mockPrismaWithAudit } = await import("@/test/prisma");
  return {
    prisma: mockPrismaWithAudit({
      parkingEvent: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: "ev-1",
            status: "ACTIVE",
            startsAt: data.startsAt ?? new Date(),
            endsAt: data.endsAt ?? null,
            ...data,
            blocks: [
              { block: { id: "block-1", name: "Estacionamiento 1" } },
            ],
          })
        ),
      },
      parkingBlock: {
        findMany: vi.fn().mockResolvedValue([
          { id: "block-1", name: "Estacionamiento 1" },
        ]),
      },
      membership: {
        findMany: vi.fn().mockResolvedValue([{ userId: "u-1" }, { userId: "u-2" }]),
      },
      vehicle: {
        findMany: vi.fn().mockResolvedValue([{ ownerId: "u-1", currentBlockId: "block-1" }]),
      },
      notification: {
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    }),
  };
});

import { prisma } from "@/lib/prisma";
import { GET, POST } from "./route";
import { ORG_A, auditedIn, params, scopedTo, tenantRequest } from "@/test/tenant";

describe("GET /api/events", () => {
  beforeEach(() => vi.clearAllMocks());

  it("permite a un USER consultar eventos activos del banner filtrados por su organización", async () => {
    vi.mocked(prisma.parkingEvent.findMany).mockResolvedValueOnce([
      {
        id: "ev-all",
        title: "Exposición",
        description: "Cerrado Est. 3",
        kind: "EVENT",
        disableEntry: true,
        audience: "ALL",
        startsAt: new Date("2026-10-28T10:00:00Z"),
        endsAt: null,
        blocks: [{ block: { id: "block-3", name: "Estacionamiento 3" } }],
      },
      {
        id: "ev-guards",
        title: "Cambio de turno",
        description: "Interno",
        kind: "NOTICE",
        disableEntry: false,
        audience: "GUARDS",
        startsAt: new Date("2026-10-28T10:00:00Z"),
        endsAt: null,
        blocks: [],
      },
    ] as never);

    const req = await tenantRequest("/api/events?scope=active", { role: "USER", sub: "u-1" });
    const res = await GET(req, params({}));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(prisma.parkingEvent.findMany).toHaveBeenCalledWith(scopedTo(ORG_A));
    expect(body.events).toHaveLength(1);
    expect(body.events[0].id).toBe("ev-all");
  });

  it("impide a un USER listar el historial administrativo completo de eventos", async () => {
    const req = await tenantRequest("/api/events", { role: "USER", sub: "u-1" });
    const res = await GET(req, params({}));
    expect(res.status).toBe(403);
    expect(prisma.parkingEvent.findMany).not.toHaveBeenCalled();
  });

  it("lista eventos solo de la organización de la sesión para ADMIN", async () => {
    const req = await tenantRequest("/api/events", { role: "ADMIN" });
    const res = await GET(req, params({}));
    expect(res.status).toBe(200);
    expect(prisma.parkingEvent.findMany).toHaveBeenCalledWith(scopedTo(ORG_A));
  });
});

describe("POST /api/events", () => {
  beforeEach(() => vi.clearAllMocks());

  it("solo un ADMIN puede crear eventos", async () => {
    const req = await tenantRequest(
      "/api/events",
      { role: "GUARD" },
      { method: "POST", body: { title: "Urgencia", description: "Corte eléctrico" } }
    );
    const res = await POST(req, params({}));
    expect(res.status).toBe(403);
  });

  it("crea el evento, notifica solo a miembros de su organización y registra auditoría", async () => {
    const req = await tenantRequest(
      "/api/events",
      { role: "ADMIN" },
      {
        method: "POST",
        body: {
          title: "Urgencia en Estacionamiento 1",
          description: "Fuga de agua en acceso norte",
          kind: "EMERGENCY",
          blockIds: ["block-1"],
          disableEntry: true,
          audience: "ALL",
          notify: true,
        },
      }
    );
    const res = await POST(req, params({}));
    expect(res.status).toBe(201);
    expect(prisma.parkingBlock.findMany).toHaveBeenCalledWith({
      where: { organizationId: ORG_A, id: { in: ["block-1"] } },
      select: { id: true, name: true },
    });
    expect(prisma.membership.findMany).toHaveBeenCalledWith(scopedTo(ORG_A));
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          organizationId: ORG_A,
          userId: "u-1",
          kind: "EMERGENCY",
        }),
      ]),
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(auditedIn(ORG_A, "CREATE", "EVENT"));
  });

  it("rechaza bloques que pertenezcan a otra organización", async () => {
    vi.mocked(prisma.parkingBlock.findMany).mockResolvedValueOnce([]);
    const req = await tenantRequest(
      "/api/events",
      { role: "ADMIN" },
      {
        method: "POST",
        body: {
          title: "Evento cruzado",
          description: "Intento con bloque ajeno",
          blockIds: ["block-org-b"],
        },
      }
    );
    const res = await POST(req, params({}));
    expect(res.status).toBe(404);
    expect(prisma.parkingEvent.create).not.toHaveBeenCalled();
  });

  it("rechaza fechas donde endsAt no sea posterior a startsAt", async () => {
    const req = await tenantRequest(
      "/api/events",
      { role: "ADMIN" },
      {
        method: "POST",
        body: {
          title: "Horario inválido",
          description: "Fin antes que inicio",
          startsAt: "2026-10-30T15:00:00.000Z",
          endsAt: "2026-10-30T12:00:00.000Z",
        },
      }
    );
    const res = await POST(req, params({}));
    expect(res.status).toBe(400);
    expect(prisma.parkingEvent.create).not.toHaveBeenCalled();
  });
});
