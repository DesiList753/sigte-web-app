import { describe, expect, it, vi } from "vitest";
import { buildEventNotificationMessage, eventPhase, resolveAudienceUserIds } from "./events";

describe("eventPhase", () => {
  const now = new Date("2026-10-28T15:00:00Z");

  it("marca ACTIVE cuando está dentro de la ventana o sin término", () => {
    expect(
      eventPhase(
        { status: "ACTIVE", startsAt: new Date("2026-10-28T14:00:00Z"), endsAt: null },
        now
      )
    ).toBe("ACTIVE");
    expect(
      eventPhase(
        {
          status: "ACTIVE",
          startsAt: new Date("2026-10-28T14:00:00Z"),
          endsAt: new Date("2026-10-28T18:00:00Z"),
        },
        now
      )
    ).toBe("ACTIVE");
  });

  it("marca SCHEDULED si startsAt es futuro", () => {
    expect(
      eventPhase(
        {
          status: "ACTIVE",
          startsAt: new Date("2026-10-28T16:00:00Z"),
          endsAt: new Date("2026-10-28T20:00:00Z"),
        },
        now
      )
    ).toBe("SCHEDULED");
  });

  it("marca ENDED automáticamente cuando pasa endsAt o cuando su estado es ENDED", () => {
    expect(
      eventPhase(
        {
          status: "ACTIVE",
          startsAt: new Date("2026-10-28T10:00:00Z"),
          endsAt: new Date("2026-10-28T15:00:00Z"),
        },
        now
      )
    ).toBe("ENDED");
    expect(
      eventPhase(
        { status: "ENDED", startsAt: new Date("2026-10-28T10:00:00Z"), endsAt: null },
        now
      )
    ).toBe("ENDED");
  });

  it("respeta CANCELLED aunque las fechas sean futuras", () => {
    expect(
      eventPhase(
        {
          status: "CANCELLED",
          startsAt: new Date("2026-10-29T10:00:00Z"),
          endsAt: null,
        },
        now
      )
    ).toBe("CANCELLED");
  });
});

describe("resolveAudienceUserIds", () => {
  it("para AFFECTED_VEHICLES deduce propietarios únicos solo en su organización", async () => {
    const db = {
      membership: { findMany: vi.fn() },
      vehicle: {
        findMany: vi.fn().mockResolvedValue([
          { ownerId: "u1" },
          { ownerId: "u2" },
          { ownerId: "u1" },
        ]),
      },
    };
    const ids = await resolveAudienceUserIds(
      db as never,
      "org-a",
      "AFFECTED_VEHICLES",
      ["b1", "b2"]
    );
    expect(ids).toEqual(["u1", "u2"]);
    expect(db.vehicle.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org-a", currentBlockId: { in: ["b1", "b2"] } },
      select: { ownerId: true },
    });
    expect(db.membership.findMany).not.toHaveBeenCalled();
  });

  it("para USERS filtra membresías activas con rol USER de la organización", async () => {
    const db = {
      membership: { findMany: vi.fn().mockResolvedValue([{ userId: "u1" }]) },
      vehicle: { findMany: vi.fn() },
    };
    const ids = await resolveAudienceUserIds(db as never, "org-a", "USERS", []);
    expect(ids).toEqual(["u1"]);
    expect(db.membership.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org-a", active: true, role: "USER" },
      select: { userId: true },
    });
  });
});

describe("buildEventNotificationMessage", () => {
  it("incluye los bloques con ingreso cerrado en el mensaje", () => {
    const msg = buildEventNotificationMessage({
      description: "Exposición anual en patio central.",
      blockNames: ["Estacionamiento 3", "Estacionamiento 4"],
      disableEntry: true,
      startsAt: new Date("2026-10-28T12:00:00Z"),
      endsAt: null,
      now: new Date("2026-10-28T12:00:00Z"),
    });
    expect(msg).toContain("Ingreso cerrado en: Estacionamiento 3, Estacionamiento 4.");
  });
});
