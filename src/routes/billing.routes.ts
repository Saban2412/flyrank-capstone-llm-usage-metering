import { BillingController } from "../controllers/billing.controller.js";
import { Router } from "express";
const router = Router();
const controller = new BillingController();

router.get("/plans", (req, res) => controller.getAllPlans(req, res));
router.get("/tenants", (req, res) => controller.getAllTenants(req, res));
router.get("/tenants/:id", (req, res) => controller.getTenantById(req, res));

export default router;
