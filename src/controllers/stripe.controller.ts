import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { StripeService } from "../services/stripe.service.js";
import { BadRequestError } from "../errors/app-error.js";

const checkoutSchema = z.object({
  tenantId: z.coerce.number().int().positive(),
});

export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  createCheckout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = checkoutSchema.parse(req.body);
      const result =
        await this.stripeService.createProCheckoutSession(tenantId);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  handleWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signature = req.headers["stripe-signature"];
      if (!signature || typeof signature !== "string") {
        throw new BadRequestError("Missing stripe-signature header.");
      }

      if (!Buffer.isBuffer(req.body)) {
        throw new BadRequestError(
          "Webhook body must be raw Buffer. Check express.raw() middleware order.",
        );
      }

      const result = await this.stripeService.handleWebhook(
        req.body,
        signature,
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  // Jednostavne povratne rute nakon Stripe Checkout stranice
  checkoutSuccess = (req: Request, res: Response) => {
    res.status(200).json({
      message:
        "Payment successful! Your PRO plan is being activated via webhook.",
      sessionId: req.query.session_id ?? null,
    });
  };

  checkoutCancel = (_req: Request, res: Response) => {
    res.status(200).json({
      message: "Checkout canceled. Your subscription remains unchanged.",
    });
  };
}
