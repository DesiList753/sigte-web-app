import { describe, expect, it } from "vitest";
import { dayKey, hourOf, startOfDay } from "./time";

describe("hora de Chile", () => {
  it("usa la fecha de Chile y no la UTC", () => {
    expect(dayKey(new Date("2026-10-23T02:00:00Z"))).toBe("2026-10-22");
  });

  it("devuelve la hora local en formato 0-23", () => {
    expect(hourOf(new Date("2026-10-23T02:00:00Z"))).toBe(23);
    expect(hourOf(new Date("2026-10-23T03:00:00Z"))).toBe(0);
  });

  it("calcula la medianoche de Chile en horario de verano (UTC-3)", () => {
    expect(startOfDay(new Date("2026-10-23T15:00:00Z")).toISOString()).toBe("2026-10-23T03:00:00.000Z");
  });

  it("calcula la medianoche de Chile en horario de invierno (UTC-4)", () => {
    expect(startOfDay(new Date("2026-07-01T15:00:00Z")).toISOString()).toBe("2026-07-01T04:00:00.000Z");
  });

  it("no corre la fecha a las 23:00 locales", () => {
    expect(startOfDay(new Date("2026-10-23T02:00:00Z")).toISOString()).toBe("2026-10-22T03:00:00.000Z");
  });
});
