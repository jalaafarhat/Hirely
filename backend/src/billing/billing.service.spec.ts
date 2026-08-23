import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubscriptionStatus } from '@prisma/client';
import { BillingService } from './billing.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BillingService', () => {
  let service: BillingService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };

  const ownerUser = {
    id: 'user-owner',
    email: 'jalaa.c.m@gmail.com',
    name: 'Owner',
    subscriptionStatus: SubscriptionStatus.NONE,
    subscriptionExpiresAt: null,
    paypalSubscriptionId: null,
  };

  const paidUser = {
    id: 'user-paid',
    email: 'subscriber@example.com',
    name: 'Subscriber',
    subscriptionStatus: SubscriptionStatus.ACTIVE,
    subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    paypalSubscriptionId: 'I-SUB123',
  };

  const unpaidUser = {
    id: 'user-unpaid',
    email: 'newuser@example.com',
    name: 'New User',
    subscriptionStatus: SubscriptionStatus.NONE,
    subscriptionExpiresAt: null,
    paypalSubscriptionId: null,
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          PAYPAL_CLIENT_ID: '',
          PAYPAL_CLIENT_SECRET: '',
          PAYPAL_PLAN_ID: '',
          PAYPAL_LIVE: 'false',
          NODE_ENV: 'test',
          APP_URL: 'http://localhost:4200',
        };
        return values[key];
      }),
    };

    service = new BillingService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
    );
  });

  describe('access control', () => {
    it('grants access to exempt owner email', () => {
      expect(service.hasActiveAccess(ownerUser)).toBe(true);
    });

    it('denies access without active subscription', () => {
      expect(service.hasActiveAccess(unpaidUser)).toBe(false);
    });

    it('grants access with active unexpired subscription', () => {
      expect(service.hasActiveAccess(paidUser)).toBe(true);
    });

    it('denies access when subscription expired', () => {
      expect(
        service.hasActiveAccess({
          ...paidUser,
          subscriptionExpiresAt: new Date(Date.now() - 1000),
        }),
      ).toBe(false);
    });

    it('grants access during active trial', () => {
      const trialUser = {
        ...unpaidUser,
        trialExpiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
      };
      expect(service.hasActiveAccess(trialUser)).toBe(true);
      expect(service.isOnTrial(trialUser)).toBe(true);
    });

    it('denies access when trial expired', () => {
      expect(
        service.hasActiveAccess({
          ...unpaidUser,
          trialExpiresAt: new Date(Date.now() - 1000),
        }),
      ).toBe(false);
    });

    it('blocks agent use for unpaid users without trial', async () => {
      prisma.user.findUnique.mockResolvedValue(unpaidUser);
      await expect(service.assertCanUseAgent('user-unpaid')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows agent use for exempt owner', async () => {
      prisma.user.findUnique.mockResolvedValue(ownerUser);
      await expect(
        service.assertCanUseAgent('user-owner'),
      ).resolves.toBeUndefined();
    });
  });

  describe('getStatus', () => {
    it('returns exempt status for owner', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue(ownerUser);
      const status = await service.getStatus('user-owner');
      expect(status.hasAccess).toBe(true);
      expect(status.exempt).toBe(true);
      expect(status.paymentConfigured).toBe(false);
      expect(status.priceCents).toBe(2000);
    });

    it('returns locked status for unpaid user', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue(unpaidUser);
      const status = await service.getStatus('user-unpaid');
      expect(status.hasAccess).toBe(false);
      expect(status.exempt).toBe(false);
      expect(status.status).toBe(SubscriptionStatus.NONE);
    });
  });

  describe('dev activation', () => {
    it('activates subscription in non-production', async () => {
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      prisma.user.update.mockResolvedValue({
        ...unpaidUser,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        subscriptionExpiresAt: expiresAt,
      });
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        ...unpaidUser,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        subscriptionExpiresAt: expiresAt,
      });
      const status = await service.activateDevSubscription('user-unpaid');
      expect(status.hasAccess).toBe(true);
      expect(status.status).toBe(SubscriptionStatus.ACTIVE);
    });
  });

  describe('checkout', () => {
    it('rejects checkout when PayPal is not configured', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue(unpaidUser);
      await expect(
        service.createCheckoutSession('user-unpaid'),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns PayPal approval URL when configured', async () => {
      const config = {
        get: jest.fn((key: string) => {
          const values: Record<string, string> = {
            PAYPAL_CLIENT_ID: 'test-client',
            PAYPAL_CLIENT_SECRET: 'test-secret',
            PAYPAL_PLAN_ID: 'P-PLAN123',
            PAYPAL_LIVE: 'false',
            NODE_ENV: 'test',
            APP_URL: 'http://localhost:4200',
          };
          return values[key];
        }),
      };
      const paypalService = new BillingService(
        prisma as unknown as PrismaService,
        config as unknown as ConfigService,
      );

      prisma.user.findUniqueOrThrow.mockResolvedValue(unpaidUser);

      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ access_token: 'token', expires_in: 3600 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'I-SUBNEW',
              links: [
                { rel: 'approve', href: 'https://sandbox.paypal.com/approve' },
              ],
            }),
        });
      const originalFetch = global.fetch;
      global.fetch = fetchMock;

      const result = await paypalService.createCheckoutSession('user-unpaid');
      expect(result.url).toBe('https://sandbox.paypal.com/approve');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-unpaid' },
        data: { paypalSubscriptionId: 'I-SUBNEW' },
      });

      global.fetch = originalFetch;
    });
  });

  describe('webhooks', () => {
    it('activates subscription on BILLING.SUBSCRIPTION.ACTIVATED', async () => {
      prisma.user.findUnique.mockResolvedValue(unpaidUser);
      await service.handleWebhook({
        event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
        resource: { id: 'I-SUB999', custom_id: 'user-unpaid' },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-unpaid' },
        data: {
          subscriptionStatus: SubscriptionStatus.ACTIVE,
          subscriptionExpiresAt: expect.any(Date) as Date,
          paypalSubscriptionId: 'I-SUB999',
        },
      });
    });

    it('cancels subscription on BILLING.SUBSCRIPTION.CANCELLED', async () => {
      prisma.user.findFirst.mockResolvedValue(paidUser);
      await service.handleWebhook({
        event_type: 'BILLING.SUBSCRIPTION.CANCELLED',
        resource: { id: 'I-SUB123' },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-paid' },
        data: { subscriptionStatus: SubscriptionStatus.CANCELED },
      });
    });
  });
});
