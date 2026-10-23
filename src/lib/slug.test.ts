import { describe, expect, it } from "vitest";
import { SLUG_PATTERN, slugify } from "./slug";

describe("slugify", () => {
  it("quita tildes, mayúsculas y espacios", () => {
    expect(slugify("Campus Viña del Mar")).toBe("campus-vina-del-mar");
  });

  it("no deja guiones al inicio ni al final", () => {
    expect(slugify("  ¡Clínica Ñuñoa!  ")).toBe("clinica-nunoa");
  });

  it("corta en 40 caracteres sin terminar en guion", () => {
    const slug = slugify("Organización con un nombre extremadamente largo para la prueba");
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(SLUG_PATTERN.test(slug)).toBe(true);
  });
});
