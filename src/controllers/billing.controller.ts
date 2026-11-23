import { BillingService } from "../services/billing.service.js";
import { Request, Response } from "express";

const service = new BillingService();

export class BillingController {
  async getAllPlans(req: Request, res: Response): Promise<void> {
    const plans = await service.findAllPlans();
    res.status(200).json(plans);
  }
}
