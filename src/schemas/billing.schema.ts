import { z } from "zod";

export const idParamSchema = z.object({
  id: z.coerce
    .number()
    .int({ message: "ID must be integer!" })
    .positive({ message: "ID must be a positive number!" }),
});

export const createCustomerSchema = z.object({
  name: z
    .string({ message: "Ime mora biti string!" })
    .min(2, { message: "Ime mora imati minimalno 2 karaktera!" }),
  email: z
    .string({ message: "Email mora biti string!" })
    .email({ message: "Mora biti u email formatu!" })
    .toLowerCase(),
  planCode: z.enum(["FREE", "PRO"]).default("FREE"),
});
