import { BillingService } from "../services/billing.service.js";
import { Request, Response } from "express";

const service = new BillingService();

export class BillingController {
  async getAllPlans(req: Request, res: Response): Promise<void> {
    const plans = await service.findAllPlans();
    res.status(200).json(plans);
  }
  async getAllTenants(req: Request, res: Response): Promise<void> {
    const tenants = await service.findAllTenants();
    res.status(200).json(tenants);
  }
  async getTenantById(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const tenant = await service.findTenantById(id);
    res.status(200).json(tenant);
  }
}
