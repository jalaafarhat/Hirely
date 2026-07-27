import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  BILLING_EXEMPT_EMAILS,
  MONTHLY_CURRENCY,
  MONTHLY_PRICE,
  PRODUCT_DESCRIPTION,
  PRODUCT_NAME,
} from './billing.constants';

export interface BillingStatus {
  hasAccess: boolean;
  exempt: boolean;
  status: SubscriptionStatus;
  expiresAt: string | null;
  priceCents: number;
  currency: string;
  interval: 'month';
  paymentConfigured: boolean;
  provider: 'paypal';
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly clientId: string | null;
  private readonly clientSecret: string | null;
  private readonly apiBase: string;
  private cachedAccessToken: { token: string; expiresAt: number } | null = null;
  private cachedPlanId: string | null;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.clientId = this.config.get<string>('PAYPAL_CLIENT_ID')?.trim() || null;
    this.clientSecret =
      this.config.get<string>('PAYPAL_CLIENT_SECRET')?.trim() || null;
    this.cachedPlanId =
      this.config.get<string>('PAYPAL_PLAN_ID')?.trim() || null;

    // Only PAYPAL_LIVE controls sandbox vs live — never infer from NODE_ENV,
    // otherwise sandbox keys fail in production with "Client Authentication failed".
    const live =
      this.config.get<string>('PAYPAL_LIVE')?.trim()?.toLowerCase() === 'true';
    this.apiBase = live
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
    this.logger.log(`PayPal mode: ${live ? 'LIVE' : 'sandbox'}`);

    if (!this.clientId || !this.clientSecret) {
      this.logger.warn(
        'PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET not set — checkout disabled; use /billing/dev-activate in development',
      );
    }
  }

  isExemptEmail(email: string): boolean {
    return BILLING_EXEMPT_EMAILS.has(email.trim().toLowerCase());
  }

  isPaymentConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  hasActiveAccess(user: {
    email: string;
    subscriptionStatus: SubscriptionStatus;
    subscriptionExpiresAt: Date | null;
  }): boolean {
    if (this.isExemptEmail(user.email)) return true;
    if (user.subscriptionStatus !== SubscriptionStatus.ACTIVE) return false;
    if (
      user.subscriptionExpiresAt &&
      user.subscriptionExpiresAt.getTime() < Date.now()
    ) {
      return false;
    }
    return true;
  }

  async assertCanUseAgent(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
      },
    });
    if (!user) throw new ForbiddenException('User not found');
    if (!this.hasActiveAccess(user)) {
      throw new ForbiddenException(
        'An active Hirely Pro subscription ($20/month) is required to run the job search agent. Go to Subscription to subscribe.',
      );
    }
  }

  async getStatus(userId: string): Promise<BillingStatus> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        email: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
      },
    });

    return {
      hasAccess: this.hasActiveAccess(user),
      exempt: this.isExemptEmail(user.email),
      status: user.subscriptionStatus,
      expiresAt: user.subscriptionExpiresAt?.toISOString() ?? null,
      priceCents: Math.round(parseFloat(MONTHLY_PRICE) * 100),
      currency: MONTHLY_CURRENCY.toLowerCase(),
      interval: 'month',
      paymentConfigured: this.isPaymentConfigured(),
      provider: 'paypal',
    };
  }

  async createCheckoutSession(userId: string): Promise<{ url: string }> {
    if (!this.isPaymentConfigured()) {
      throw new BadRequestException(
        'PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.',
      );
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (!this.isExemptEmail(user.email) && this.hasActiveAccess(user)) {
      throw new BadRequestException('You already have an active subscription.');
    }

    const appUrl =
      this.config.get<string>('APP_URL') || 'http://localhost:4200';
    const planId = await this.ensurePlanId();

    const data = await this.paypalFetch<{
      id?: string;
      status?: string;
      links?: Array<{ rel: string; href: string }>;
      message?: string;
      details?: Array<{ description?: string }>;
    }>('/v1/billing/subscriptions', {
      method: 'POST',
      body: {
        plan_id: planId,
        custom_id: userId,
        subscriber: {
          email_address: user.email,
          name: {
            given_name: user.name?.split(' ')[0] || 'Hirely',
            surname: user.name?.split(' ').slice(1).join(' ') || 'User',
          },
        },
        application_context: {
          brand_name: 'Hirely',
          locale: 'en-US',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          return_url: `${appUrl}/billing?success=1`,
          cancel_url: `${appUrl}/billing?canceled=1`,
        },
      },
    });

    const approveUrl = data.links?.find((l) => l.rel === 'approve')?.href;
    if (!approveUrl || !data.id) {
      this.logger.error('PayPal create subscription failed', data);
      throw new BadRequestException(
        data.message ||
          data.details?.[0]?.description ||
          'Could not start PayPal checkout',
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { paypalSubscriptionId: data.id },
    });

    return { url: approveUrl };
  }

  /** After PayPal redirects back, verify subscription and unlock access. */
  async confirmSubscription(
    userId: string,
    subscriptionId?: string,
  ): Promise<BillingStatus> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const subId = subscriptionId || user.paypalSubscriptionId;
    if (!subId) {
      throw new BadRequestException('No PayPal subscription to confirm');
    }

    if (!this.isPaymentConfigured()) {
      // Allow confirm after webhook already set ACTIVE
      return this.getStatus(userId);
    }

    const sub = await this.paypalFetch<{
      id: string;
      status: string;
      custom_id?: string;
      billing_info?: { next_billing_time?: string };
    }>(`/v1/billing/subscriptions/${subId}`, { method: 'GET' });

    if (sub.custom_id && sub.custom_id !== userId) {
      throw new ForbiddenException('Subscription does not belong to this user');
    }

    if (sub.status === 'ACTIVE' || sub.status === 'APPROVED') {
      const expiresAt = sub.billing_info?.next_billing_time
        ? new Date(sub.billing_info.next_billing_time)
        : (() => {
            const d = new Date();
            d.setMonth(d.getMonth() + 1);
            return d;
          })();

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionStatus: SubscriptionStatus.ACTIVE,
          subscriptionExpiresAt: expiresAt,
          paypalSubscriptionId: sub.id,
        },
      });
    }

    return this.getStatus(userId);
  }

  async cancelSubscription(userId: string): Promise<BillingStatus> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (!user.paypalSubscriptionId) {
      throw new BadRequestException('No PayPal subscription found.');
    }

    if (this.isPaymentConfigured()) {
      try {
        await this.paypalFetch(
          `/v1/billing/subscriptions/${user.paypalSubscriptionId}/cancel`,
          {
            method: 'POST',
            body: { reason: 'Canceled by user from Hirely' },
          },
        );
      } catch (err) {
        this.logger.warn('PayPal cancel failed (marking local anyway)', err);
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { subscriptionStatus: SubscriptionStatus.CANCELED },
    });

    return this.getStatus(userId);
  }

  async activateDevSubscription(userId: string): Promise<BillingStatus> {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new ForbiddenException('Dev activation is disabled in production');
    }

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        subscriptionExpiresAt: expiresAt,
      },
    });

    return this.getStatus(userId);
  }

  /**
   * PayPal webhook JSON events.
   * @see https://developer.paypal.com/docs/api/webhooks/v1/
   */
  async handleWebhook(payload: Record<string, unknown>): Promise<void> {
    const eventType = this.webhookString(payload['event_type']);
    const resource = (payload['resource'] || {}) as Record<string, unknown>;

    const subscriptionId = this.webhookString(
      resource['id'] ?? resource['billing_agreement_id'],
    ).trim();
    const customId = this.webhookString(resource['custom_id']).trim();

    this.logger.log(
      `PayPal webhook: ${eventType} sub=${subscriptionId || '?'} user=${customId || '?'}`,
    );

    const user = customId
      ? await this.prisma.user.findUnique({ where: { id: customId } })
      : subscriptionId
        ? await this.prisma.user.findFirst({
            where: { paypalSubscriptionId: subscriptionId },
          })
        : null;

    if (!user) {
      this.logger.warn(
        `PayPal webhook: no user for ${customId || subscriptionId}`,
      );
      return;
    }

    if (
      eventType === 'BILLING.SUBSCRIPTION.ACTIVATED' ||
      eventType === 'BILLING.SUBSCRIPTION.UPDATED' ||
      eventType === 'PAYMENT.SALE.COMPLETED'
    ) {
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          subscriptionStatus: SubscriptionStatus.ACTIVE,
          subscriptionExpiresAt: expiresAt,
          paypalSubscriptionId: subscriptionId || user.paypalSubscriptionId,
        },
      });
      return;
    }

    if (
      eventType === 'BILLING.SUBSCRIPTION.CANCELLED' ||
      eventType === 'BILLING.SUBSCRIPTION.EXPIRED'
    ) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { subscriptionStatus: SubscriptionStatus.CANCELED },
      });
      return;
    }

    if (eventType === 'BILLING.SUBSCRIPTION.SUSPENDED') {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { subscriptionStatus: SubscriptionStatus.PAST_DUE },
      });
    }
  }

  private webhookString(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return '';
  }

  private async ensurePlanId(): Promise<string> {
    if (this.cachedPlanId) return this.cachedPlanId;

    const product = await this.paypalFetch<{ id: string }>(
      '/v1/catalogs/products',
      {
        method: 'POST',
        body: {
          name: PRODUCT_NAME,
          description: PRODUCT_DESCRIPTION,
          type: 'SERVICE',
          category: 'SOFTWARE',
        },
      },
    );

    const plan = await this.paypalFetch<{ id: string }>('/v1/billing/plans', {
      method: 'POST',
      body: {
        product_id: product.id,
        name: `${PRODUCT_NAME} Monthly`,
        description: PRODUCT_DESCRIPTION,
        billing_cycles: [
          {
            frequency: { interval_unit: 'MONTH', interval_count: 1 },
            tenure_type: 'REGULAR',
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: {
              fixed_price: {
                value: MONTHLY_PRICE,
                currency_code: MONTHLY_CURRENCY,
              },
            },
          },
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee_failure_action: 'CONTINUE',
          payment_failure_threshold: 3,
        },
      },
    });

    this.cachedPlanId = plan.id;
    this.logger.log(
      `Created PayPal plan ${plan.id} — set PAYPAL_PLAN_ID=${plan.id} to reuse it`,
    );
    return plan.id;
  }

  private async getAccessToken(): Promise<string> {
    if (
      this.cachedAccessToken &&
      this.cachedAccessToken.expiresAt > Date.now() + 60_000
    ) {
      return this.cachedAccessToken.token;
    }

    if (!this.clientId || !this.clientSecret) {
      throw new BadRequestException('PayPal credentials missing');
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
      'base64',
    );

    const res = await fetch(`${this.apiBase}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    const data = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
      error_description?: string;
    };

    if (!res.ok || !data.access_token) {
      throw new BadRequestException(
        data.error_description || 'PayPal auth failed',
      );
    }

    this.cachedAccessToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in || 300) * 1000,
    };
    return data.access_token;
  }

  private async paypalFetch<T>(
    path: string,
    options: { method: string; body?: unknown },
  ): Promise<T> {
    const token = await this.getAccessToken();
    const res = await fetch(`${this.apiBase}${path}`, {
      method: options.method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Prefer: 'return=representation',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (res.status === 204) return {} as T;

    const data = (await res.json()) as T & {
      message?: string;
      details?: Array<{ description?: string }>;
    };

    if (!res.ok) {
      this.logger.error(`PayPal ${options.method} ${path} failed`, data);
      throw new BadRequestException(
        data.message ||
          data.details?.[0]?.description ||
          `PayPal request failed (${res.status})`,
      );
    }

    return data;
  }
}
