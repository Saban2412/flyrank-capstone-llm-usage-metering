import { BillingService } from "../services/billing.service.js";
import { Request, Response } from "express";
import {
  idParamSchema,
  createCustomerSchema,
  planCodeSchema,
} from "../schemas/billing.schema.js";

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
  async getTenantByIdWithSubscription(
    req: Request,
    res: Response,
  ): Promise<void> {
    const { id } = idParamSchema.parse(req.params);
    const tenant = await service.findTenantByIdWithSubscription(id);
    res.status(200).json(tenant);
  }
  async cretaTenantWithSubscription(
    req: Request,
    res: Response,
  ): Promise<void> {
    const { name, email, planCode } = createCustomerSchema.parse(req.body);
    const newTenant = await service.createTenantWithSubscription({
      name,
      email,
      planCode,
    });
    res.status(201).json(newTenant);
  }
  async updateSubscriptionPlan(req: Request, res: Response): Promise<void> {
    const { id } = idParamSchema.parse(req.params);
    const { planCode } = planCodeSchema.parse(req.body);
    const updatedTenant = await service.updateSubscriptionPlan(id, planCode);
    res.status(200).json(updatedTenant);
  }
}
