import { BadRequestError, NotFoundError } from "../errors/app-error.js";
import { PlansRepository } from "../repositories/plans.repository.js";
import { Plans } from "../types/billing.js";

export class BillingRepository {
  private plansRepo = new PlansRepository();

  async findAllPlans(): Promise<Plans[]> {
    const result = await this.plansRepo.findAll();
    return result;
  }
}
