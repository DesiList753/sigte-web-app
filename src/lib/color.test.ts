import { describe, expect, it } from "vitest";
import { contrastWithWhite, readableOnWhite } from "./color";

describe("contraste del color de marca", () => {
  it("calcula el contraste contra blanco", () => {
    expect(contrastWithWhite("#000000")).toBeCloseTo(21, 0);
    expect(contrastWithWhite("#FFFFFF")).toBeCloseTo(1, 5);
  });

  it("acepta colores oscuros donde el texto blanco se lee bien", () => {
    expect(readableOnWhite("#004B85")).toBe(true);
    expect(readableOnWhite("#0F766E")).toBe(true);
  });

  it("rechaza colores claros y formatos inválidos", () => {
    expect(readableOnWhite("#F7AE00")).toBe(false);
    expect(readableOnWhite("#FFFFFF")).toBe(false);
    expect(readableOnWhite("azul")).toBe(false);
  });
});
