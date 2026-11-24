import {
  BadRequestError,
  NotFoundError,
  ToManyRequestError,
  PaymentRequiredError,
} from "../errors/app-error.js";
import { PlansRepository } from "../repositories/plans.repository.js";
import { TenantRepository } from "../repositories/tenants.repository.js";
import { UsageRepository } from "../repositories/usage.repository.js";
import {
  CreateUsageEventInput,
  PlanCode,
  Plans,
  UsageEvent,
  Tenant,
} from "../types/billing.js";
import { generatePromptHash } from "../utils/promptHash.js";
import { simulateAiCompletion } from "../utils/llmSimulator.js";
import { calculateEventCostMicroCents } from "../config/pricing.js";
export class BillingService {
  private plansRepo = new PlansRepository();
  private tenantRepo = new TenantRepository();
  private usageRepo = new UsageRepository();

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
  async updateSubscriptionPlan(
    tenantId: number,
    planCode: PlanCode,
  ): Promise<Tenant> {
    return await this.tenantRepo.updateSubscriptionPlan(tenantId, planCode);
  }
  async createUsageEvent(
    tenantId: number,
    prompt: string,
    idempotencyKey: string,
  ): Promise<UsageEvent> {
    const foundByKey =
      await this.usageRepo.findByIdempotencyKey(idempotencyKey);
    if (foundByKey) return foundByKey;

    const tenant = await this.tenantRepo.findByIdWithSubscription(tenantId);
    if (!tenant) {
      throw new NotFoundError(`Tenant with id ${tenantId} is not found!`);
    }

    const usage = await this.usageRepo.getPeriodUsageSummary(
      tenantId,
      tenant.subscription.currentPeriodStart,
      tenant.subscription.currentPeriodEnd,
    );

    if (
      usage.totalApiCalls >= tenant.subscription.maxApiCallsPerMonth ||
      usage.totalTokens >= tenant.subscription.maxTokensPerMonth
    ) {
      throw new ToManyRequestError(
        "The tenant has exceeded the monthly plan limit!",
      );
    }

    const hashPrompt = generatePromptHash(prompt);
    const cacheHit = await this.usageRepo.findByPromptHash(
      tenantId,
      hashPrompt,
    );
    const aiCompletion = simulateAiCompletion(prompt, cacheHit);

    const eventTokens =
      aiCompletion.inputTokens +
      aiCompletion.cachedInputTokens +
      aiCompletion.reasoningTokens +
      aiCompletion.outputTokens;

    if (
      usage.totalApiCalls + aiCompletion.apiCalls >
        tenant.subscription.maxApiCallsPerMonth ||
      usage.totalTokens + eventTokens > tenant.subscription.maxTokensPerMonth
    ) {
      throw new PaymentRequiredError(
        "Request exceeds remaining monthly quota. Upgrade to PRO!",
      );
    }

    const totalCost = calculateEventCostMicroCents(aiCompletion);

    const data: CreateUsageEventInput = {
      tenantId,
      idempotencyKey,
      endpoint: "POST /api/generate",
      apiCalls: aiCompletion.apiCalls,
      inputTokens: aiCompletion.inputTokens,
      cachedInputTokens: aiCompletion.cachedInputTokens,
      reasoningTokens: aiCompletion.reasoningTokens,
      outputTokens: aiCompletion.outputTokens,
      totalTokens: eventTokens, // Samo tokeni ovog događaja!
      costMicroCents: totalCost,
      responsePayload: {
        model: aiCompletion.model,
        answer: aiCompletion.answer,
      },
      promptHash: hashPrompt,
    };

    return await this.usageRepo.createEvent(data);
  }
}
