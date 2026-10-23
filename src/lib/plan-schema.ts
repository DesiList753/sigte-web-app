import { z } from "zod";
import { slugSchema } from "./organizations";

const limit = z.number().int().min(1, "El límite debe ser al menos 1").nullable();

export const planSchema = z.object({
  code: slugSchema,
  name: z.string().min(2),
  maxUsers: limit,
  maxGuards: limit,
  maxBlocks: limit,
  maxVehicles: limit,
  features: z.array(z.enum(["QR", "INFRACTIONS", "REPORTS"])),
});

export const planPatchSchema = planSchema.omit({ code: true }).partial();
