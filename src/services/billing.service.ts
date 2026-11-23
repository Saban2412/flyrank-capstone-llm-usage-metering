import { da } from "zod/locales";
import { BadRequestError, NotFoundError } from "../errors/app-error.js";
import { PlansRepository } from "../repositories/plans.repository.js";
import { TenantRepository } from "../repositories/tenants.repository.js";
import { PlanCode, Plans } from "../types/billing.js";
import { Tenant } from "../types/billing.js";

export class BillingService {
  private plansRepo = new PlansRepository();
  private tenantRepo = new TenantRepository();

  async findAllPlans(): Promise<Plans[]> {
    const result = await this.plansRepo.findAll();
    return result;
  }
  async findAllTenants(): Promise<Tenant[]> {
    const result = await this.tenantRepo.findAllTenants();
    return result;
  }
  async findTenantByIdWithSubscription(id: number): Promise<Tenant> {
    const result = await this.tenantRepo.findByIdWithSubscription(id);
    if (!result) throw new NotFoundError(`Tenant with id ${id} is not found!`);
    return result;
  }
  async createTenantWithSubscription(data: {
    name: string;
    email: string;
    planCode: PlanCode;
  }): Promise<Tenant> {
    const plan = await this.plansRepo.findByCode(data.planCode);
    if (!plan)
      throw new BadRequestError(
        `Plan code: ${data.planCode} is not available!`,
      );
    const tenants = await this.findAllTenants();
    tenants.forEach((t) => {
      if (t.email === data.email) {
        throw new BadRequestError(`Email ${data.email} already exists!`);
      }
    });
    const result = await this.tenantRepo.createWithSubscription(data);
    if (!result)
      throw new BadRequestError(
        "Wrong data format provided! Email and Name must be type of string.",
      );
    return result;
  }
}
