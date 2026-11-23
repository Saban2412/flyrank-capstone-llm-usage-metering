import { BadRequestError, NotFoundError } from "../errors/app-error.js";
import { PlansRepository } from "../repositories/plans.repository.js";
import { TenantRepository } from "../repositories/tenants.repository.js";
import { Plans } from "../types/billing.js";
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
  async findTenantById(id: number): Promise<Tenant> {
    const result = await this.tenantRepo.findById(id);
    if (!result) {
      throw new NotFoundError(`Tenant with id ${id} is not found!`);
    }
    return result;
  }
}
