import { describe, expect, it } from "vitest";
import { formatDetail } from "./audit-labels";

describe("formatDetail", () => {
  it("muestra el valor anterior antes que el nuevo aunque la base cambie el orden", () => {
    expect(formatDetail({ to: "profesional", from: "basico" })).toBe("Antes: basico · Ahora: profesional");
  });

  it("traduce roles y nombres de campos", () => {
    expect(formatDetail({ email: "a@b.cl", from: "USER", to: "GUARD" })).toBe(
      "Correo: a@b.cl · Antes: Usuario · Ahora: Guardia"
    );
    expect(formatDetail({ fields: ["displayName", "brandColor"] })).toBe("Campos: nombre visible, color");
    expect(formatDetail({ name: "Básico", fields: ["maxGuards", "features"] })).toBe(
      "Nombre: Básico · Campos: máximo de guardias, funciones"
    );
  });

  it("devuelve vacío si no hay detalle", () => {
    expect(formatDetail(null)).toBe("");
  });
});
