import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';

interface BillingStatus {
  hasAccess: boolean;
  exempt: boolean;
  status: string;
  expiresAt: string | null;
  priceCents: number;
  currency: string;
  interval: string;
  paymentConfigured: boolean;
  provider: string;
}

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="page">
      <h1 class="page-title">Subscription</h1>
      <p class="page-subtitle">Pay $20/month via PayPal to unlock the Hirely job search agent</p>

      @if (banner()) {
        <div class="banner" [class.ok]="bannerOk()">{{ banner() }}</div>
      }

      @if (loading()) {
        <p>Loading billing status...</p>
      } @else if (status()) {
        <div class="plan card">
          <div class="plan-price">
            <span class="amount">{{ '$' + priceDollars() }}</span>
            <span class="per">/ month</span>
          </div>
          <h2 class="plan-name">Hirely Pro</h2>
          <p class="provider">
            Payments by
            <a href="https://www.paypal.com/" target="_blank" rel="noopener">PayPal</a>
          </p>
          <ul class="features">
            <li>On-demand job search agent</li>
            <li>Scheduled email digests</li>
            <li>AI match scoring against your CV</li>
            <li>Company career boards (Google, Amazon, Microsoft, and more)</li>
          </ul>

          <div class="status-row">
            <span class="label">Access</span>
            <span class="value" [class.active]="status()!.hasAccess">
              @if (status()!.exempt) {
                Free (owner account)
              } @else if (status()!.hasAccess) {
                Active — {{ status()!.status }}
              } @else {
                Locked — subscribe to run searches
              }
            </span>
          </div>

          @if (status()!.exempt) {
            <div class="info-box">
              Your account has <strong>free owner access</strong> — you do not need to subscribe.
              To test the real PayPal payment flow, use the button below or register a different email.
            </div>
          }

          @if (!status()!.paymentConfigured) {
            <div class="info-box warn">
              PayPal is not configured on the server. Add <code>PAYPAL_CLIENT_ID</code> and
              <code>PAYPAL_CLIENT_SECRET</code> to Railway (production) or <code>backend/.env</code> (local), then restart the API.
            </div>
          }

          @if (status()!.expiresAt && status()!.hasAccess && !status()!.exempt) {
            <div class="status-row">
              <span class="label">Renews / expires</span>
              <span class="value">{{ formatDate(status()!.expiresAt!) }}</span>
            </div>
          }

          @if (error()) {
            <p class="error">{{ error() }}</p>
          }

          <div class="actions">
            @if (!status()!.hasAccess || status()!.exempt) {
              @if (status()!.paymentConfigured) {
                <button class="btn-primary" type="button" (click)="checkout()" [disabled]="busy()">
                  @if (status()!.exempt) {
                    {{ busy() ? 'Redirecting to PayPal…' : 'Test PayPal checkout' }}
                  } @else {
                    {{ busy() ? 'Redirecting to PayPal…' : 'Subscribe with PayPal — $' + priceDollars() + '/mo' }}
                  }
                </button>
                <p class="hint">
                  You will be redirected to PayPal's secure page to log in and enter your card or PayPal balance.
                  Hirely does not collect card details directly.
                </p>
              } @else if (!status()!.exempt) {
                <button class="btn-primary" type="button" (click)="devActivate()" [disabled]="busy()">
                  {{ busy() ? 'Activating…' : 'Activate Pro (dev — no PayPal)' }}
                </button>
                <p class="hint">
                  PayPal keys missing. Dev activation works only when NODE_ENV is not production.
                </p>
              }
            } @else if (!status()!.exempt && status()!.hasAccess && status()!.paymentConfigured) {
              <button class="btn-secondary" type="button" (click)="cancel()" [disabled]="busy()">
                {{ busy() ? 'Canceling…' : 'Cancel subscription' }}
              </button>
            }

            <a routerLink="/dashboard" class="btn-secondary">Back to Dashboard</a>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-title { font-size: 24px; font-weight: 700; }
    .page-subtitle { color: var(--text-secondary); margin: 4px 0 24px; }
    .banner {
      padding: 12px 16px;
      border-radius: 10px;
      margin-bottom: 16px;
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #f59e0b;
      font-size: 14px;
    }
    .banner.ok {
      background: #ecfdf5;
      color: #065f46;
      border-color: var(--success);
    }
    .plan { max-width: 480px; padding: 28px; }
    .plan-price { display: flex; align-items: baseline; gap: 6px; margin-bottom: 8px; }
    .amount { font-size: 40px; font-weight: 800; letter-spacing: -1px; }
    .per { color: var(--text-secondary); font-size: 16px; }
    .plan-name { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    .provider { font-size: 13px; color: var(--text-secondary); margin-bottom: 16px; }
    .provider a { color: var(--accent); }
    .features { list-style: none; padding: 0; margin: 0 0 24px; display: flex; flex-direction: column; gap: 10px; }
    .features li { font-size: 14px; color: var(--text-secondary); padding-left: 22px; position: relative; }
    .features li::before { content: '✓'; position: absolute; left: 0; color: var(--success); font-weight: 700; }
    .status-row { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-top: 1px solid var(--border-color); font-size: 14px; }
    .label { color: var(--text-secondary); }
    .value.active { color: var(--success); font-weight: 600; }
    .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; align-items: center; }
    .hint { width: 100%; font-size: 12px; color: var(--text-secondary); margin: 0; }
    .info-box {
      margin: 16px 0 0;
      padding: 12px 14px;
      border-radius: 8px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      font-size: 13px;
      line-height: 1.5;
      color: var(--text-secondary);
    }
    .info-box.warn {
      border-color: #f59e0b;
      background: #fffbeb;
      color: #92400e;
    }
    .info-box code { font-size: 12px; }
    .error { color: var(--danger); margin: 12px 0 0; font-size: 14px; }
  `],
})
export class BillingComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  status = signal<BillingStatus | null>(null);
  loading = signal(true);
  busy = signal(false);
  error = signal('');
  banner = signal('');
  bannerOk = signal(false);

  ngOnInit() {
    const params = this.route.snapshot.queryParamMap;
    if (params.get('success') === '1') {
      this.banner.set('Confirming your PayPal subscription…');
      this.bannerOk.set(true);
      this.confirmReturn(params.get('subscription_id') || undefined);
    } else if (params.get('canceled') === '1') {
      this.banner.set('Checkout canceled. You can subscribe anytime.');
      this.bannerOk.set(false);
      this.load();
    } else {
      this.load();
    }
  }

  priceDollars(): number {
    return Math.round((this.status()?.priceCents ?? 2000) / 100);
  }

  formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return iso;
    }
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const s = await this.api.get<BillingStatus>('/billing/status');
      this.status.set(s);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Failed to load billing');
    } finally {
      this.loading.set(false);
    }
  }

  async confirmReturn(subscriptionId?: string) {
    this.loading.set(true);
    try {
      const s = await this.api.post<BillingStatus>('/billing/confirm', {
        subscriptionId,
      });
      this.status.set(s);
      if (s.hasAccess) {
        this.banner.set('Hirely Pro is active. You can run the job search agent now.');
        this.bannerOk.set(true);
      } else {
        this.banner.set(
          'Payment received. If access is not active yet, wait a moment and refresh.',
        );
      }
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Could not confirm payment');
      await this.load();
    } finally {
      this.loading.set(false);
    }
  }

  async checkout() {
    this.busy.set(true);
    this.error.set('');
    try {
      const { url } = await this.api.post<{ url: string }>('/billing/checkout');
      window.location.href = url;
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Checkout failed');
      this.busy.set(false);
    }
  }

  async cancel() {
    if (!confirm('Cancel your Hirely Pro subscription?')) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const s = await this.api.post<BillingStatus>('/billing/cancel');
      this.status.set(s);
      this.banner.set('Subscription canceled.');
      this.bannerOk.set(false);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      this.busy.set(false);
    }
  }

  async devActivate() {
    this.busy.set(true);
    this.error.set('');
    try {
      const s = await this.api.post<BillingStatus>('/billing/dev-activate');
      this.status.set(s);
      this.banner.set('Dev subscription activated for 30 days.');
      this.bannerOk.set(true);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Activation failed');
    } finally {
      this.busy.set(false);
    }
  }
}
