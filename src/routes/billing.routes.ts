import { BillingController } from "../controllers/billing.controller.js";
import { Router } from "express";
import { TenantRepository } from "../repositories/tenants.repository.js";
const router = Router();
const controller = new BillingController();
const repo = new TenantRepository();

router.get("/plans", (req, res) => controller.getAllPlans(req, res));
router.get("/tenants", (req, res) => controller.getAllTenants(req, res));
router.get("/tenants/:id", (req, res) =>
  controller.getTenantByIdWithSubscription(req, res),
);
router.post("/tenants", (req, res) =>
  controller.cretaTenantWithSubscription(req, res),
);
router.patch("/tenants/:id", (req, res) =>
  controller.updateSubscriptionPlan(req, res),
);
router.post("/generate", (req, res) => controller.createUsageEvent(req, res));
router.get("/tenants/:id/usage", (req, res) =>
  controller.getUsageSummary(req, res),
);
export default router;
