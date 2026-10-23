import { z } from "zod";
import { HEX_COLOR, readableOnWhite } from "./color";

export const organizationSettingsSchema = z
  .object({
    displayName: z.string().trim().min(2, "El nombre visible debe tener al menos 2 caracteres").max(60),
    logoUrl: z
      .string()
      .trim()
      .refine((v) => v.startsWith("/") || v.startsWith("https://"), "Usa una URL https o una ruta del sitio")
      .nullable(),
    brandColor: z
      .string()
      .regex(HEX_COLOR, "Usa un color en formato #RRGGBB")
      .refine(readableOnWhite, "Ese color es muy claro: el texto blanco no se leería. Elige uno más oscuro.")
      .nullable(),
    registrationForm: z.enum(["BASIC", "ACADEMIC"]),
    selfRegistration: z.boolean(),
    allowedEmailDomains: z.array(
      z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/, "Dominio inválido")
    ),
  })
  .partial();
