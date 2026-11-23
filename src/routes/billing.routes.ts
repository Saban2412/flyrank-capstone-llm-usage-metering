import { BillingController } from "../controllers/billing.controller.js";
import { Router, Request, Response } from "express";
const router = Router();
const controller = new BillingController();

router.get("/plans", (req, res) => controller.getAllPlans(req, res));

export default router;
