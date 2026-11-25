import { z } from "zod";

export const idParamSchema = z.object({
  id: z.coerce
    .number()
    .int({ message: "ID must be integer!" })
    .positive({ message: "ID must be a positive number!" }),
});

export const planCodeSchema = z.object({
  planCode: z.enum(["FREE", "PRO"]).default("FREE"),
});

export const createCustomerSchema = z.object({
  name: z
    .string({ message: "Ime mora biti string!" })
    .min(2, { message: "Ime mora imati minimalno 2 karaktera!" }),
  email: z
    .string({ message: "Email mora biti string!" })
    .email({ message: "Mora biti u email formatu!" })
    .toLowerCase(),
  planCode: z.enum(["FREE"]).default("FREE"),
});
export const promptSchema = z.object({
  prompt: z
    .string({ message: "Prompt must be string!" })
    .trim()
    .min(1, { message: "Prompt must contain at least 1 caracter!" })
    .max(10000, { message: "Prompt is too long." })
    .toLowerCase(),
});
export const idempotencyKeySchema = z.object({
  "idempotency-key": z.uuid({
    message: "Idempotency key must be a UUID format.",
  }),
});
