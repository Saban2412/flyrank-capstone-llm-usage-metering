import { Router } from "express";
import { StripeController } from "../controllers/stripe.controller.js";

export function createBillingRouter(
  stripeController: StripeController,
): Router {
  const router = Router();

  router.post("/checkout", stripeController.createCheckout);
  router.get("/success", stripeController.checkoutSuccess);
  router.get("/cancel", stripeController.checkoutCancel);

  return router;
}
