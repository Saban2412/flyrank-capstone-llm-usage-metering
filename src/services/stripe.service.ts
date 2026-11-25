import Stripe from "stripe";
import { env } from "../config/env.js";
import { TenantRepository } from "../repositories/tenants.repository.js";
import { BadRequestError, NotFoundError } from "../errors/app-error.js";

export class StripeService {
  private stripe: Stripe;

  constructor(private readonly tenantRepo: TenantRepository) {
    this.stripe = new Stripe(env.STRIPE_SECRET_KEY);
  }

  async createProCheckoutSession(
    tenantId: number,
  ): Promise<{ checkoutUrl: string; sessionId: string }> {
    const tenant = await this.tenantRepo.findByIdWithSubscription(tenantId);
    if (!tenant) {
      throw new NotFoundError(`Tenant with id ${tenantId} not found.`);
    }

    if (tenant.subscription.planCode === "PRO") {
      throw new BadRequestError("Tenant is already on the PRO plan.");
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: tenant.email,
      line_items: [
        {
          price: env.STRIPE_PRO_PRICE_ID,
          quantity: 1,
        },
      ],
      metadata: {
        tenantId: String(tenant.id),
      },
      success_url: `${env.APP_BASE_URL}/api/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.APP_BASE_URL}/api/billing/cancel`,
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL.");
    }

    return {
      checkoutUrl: session.url,
      sessionId: session.id,
    };
  }

  async handleWebhook(
    rawBody: Buffer,
    signature: string,
  ): Promise<{ received: boolean }> {
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Invalid webhook signature";
      throw new BadRequestError(`Webhook Error: ${msg}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantIdRaw = session.metadata?.tenantId;

      if (!tenantIdRaw) {
        return { received: true };
      }

      await this.tenantRepo.upgradeTenantFromStripeWebhook({
        stripeEventId: event.id,
        eventType: event.type,
        tenantId: Number(tenantIdRaw),
        stripeCustomerId:
          typeof session.customer === "string" ? session.customer : null,
        stripeSubscriptionId:
          typeof session.subscription === "string"
            ? session.subscription
            : null,
      });
    } else if (
      event.type === "customer.subscription.deleted" ||
      (event.type === "customer.subscription.updated" &&
        (event.data.object as Stripe.Subscription).status === "canceled")
    ) {
      const subscription = event.data.object as Stripe.Subscription;

      await this.tenantRepo.downgradeTenantToFreeFromWebhook({
        stripeEventId: event.id,
        eventType: event.type,
        stripeSubscriptionId: subscription.id,
      });
    }

    return { received: true };
  }
}
