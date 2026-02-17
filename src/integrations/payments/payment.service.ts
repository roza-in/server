/**
 * Payment Service (Integration Layer)
 *
 * Orchestrates payment providers (Razorpay, Cashfree) with admin-switchable
 * active provider support via database (system_settings) & environment variables.
 *
 * Features:
 *  - Dynamic provider switching (admin-configurable)
 *  - Result caching (1-minute TTL)
 *  - Audit logging for configuration changes
 *  - Fallback: DB setting -> ENV -> first configured provider
 *  - Unified webhook verification & parsing
 */

import { supabaseAdmin } from '../../database/supabase-admin.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { logAudit } from '../../config/audit.js';
import type {
  PaymentProvider,
  PaymentOrder,
  PaymentRefund,
  PaymentOrderStatus,
  PaymentProviderName,
  PaymentProviderStatus,
  WebhookEvent,
} from './payment.types.js';
import { RazorpayProvider } from './razorpay/razorpay.provider.js';
import { CashfreeProvider } from './cashfree/cashfree.provider.js';

const log = logger.child('PaymentService');

class PaymentService {
  private providers: Record<PaymentProviderName, PaymentProvider>;
  private cachedActiveProvider: PaymentProviderName | null = null;
  private cacheExpiry = 0;
  private readonly CACHE_TTL_MS = 60_000; // 1 minute

  constructor() {
    this.providers = {
      razorpay: new RazorpayProvider(),
      cashfree: new CashfreeProvider(),
    };
  }

  // 
  // Provider Resolution
  // 

  /**
   * Get the currently active payment provider name.
   * Priority: DB system_settings -> ENV PAYMENT_PROVIDER -> first configured
   */
  async getActiveProviderName(): Promise<PaymentProviderName> {
    // Check cache first
    if (this.cachedActiveProvider && Date.now() < this.cacheExpiry) {
      return this.cachedActiveProvider;
    }

    try {
      // 1. Database setting
      const { data: setting, error } = await supabaseAdmin
        .from('system_settings')
        .select('value')
        .eq('key', 'payment_provider')
        .single();

      if (!error && setting?.value) {
        const dbProvider = setting.value.toLowerCase() as PaymentProviderName;
        if (this.providers[dbProvider] && this.isProviderConfigured(dbProvider)) {
          this.setCache(dbProvider);
          return dbProvider;
        }
      }
    } catch {
      log.warn('Failed to fetch payment settings from DB, falling back to ENV');
    }

    // 2. Environment variable
    const envProvider = (env.PAYMENT_PROVIDER || 'cashfree').toLowerCase() as PaymentProviderName;
    if (this.providers[envProvider] && this.isProviderConfigured(envProvider)) {
      this.setCache(envProvider);
      return envProvider;
    }

    // 3. First configured provider
    const fallback: PaymentProviderName = this.isProviderConfigured('cashfree')
      ? 'cashfree'
      : 'razorpay';
    this.setCache(fallback);
    return fallback;
  }

  /**
   * Get the active payment provider instance.
   */
  async getActiveProvider(): Promise<PaymentProvider> {
    const name = await this.getActiveProviderName();
    return this.providers[name];
  }

  /**
   * Get a specific provider by name.
   */
  getProvider(name: PaymentProviderName): PaymentProvider {
    return this.providers[name];
  }

  /**
   * Check if a provider has its env credentials configured.
   */
  private isProviderConfigured(provider: PaymentProviderName): boolean {
    switch (provider) {
      case 'razorpay':
        return !!(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
      case 'cashfree':
        return !!(env.CASHFREE_APP_ID && env.CASHFREE_SECRET_KEY);
      default:
        return false;
    }
  }

  private setCache(provider: PaymentProviderName): void {
    this.cachedActiveProvider = provider;
    this.cacheExpiry = Date.now() + this.CACHE_TTL_MS;
  }

  clearCache(): void {
    this.cachedActiveProvider = null;
    this.cacheExpiry = 0;
  }

  // 
  // Admin Operations
  // 

  /**
   * Switch the active payment provider (admin action).
   */
  async switchProvider(
    newProvider: PaymentProviderName,
    adminUserId: string,
  ): Promise<{ success: boolean; message: string }> {
    if (!this.providers[newProvider]) {
      return { success: false, message: `Invalid provider: ${newProvider}` };
    }

    if (!this.isProviderConfigured(newProvider)) {
      return {
        success: false,
        message: `Provider ${newProvider} is not configured. Set the required environment variables.`,
      };
    }

    try {
      const previousProvider = await this.getActiveProviderName();

      const { error } = await supabaseAdmin
        .from('system_settings')
        .upsert(
          {
            key: 'payment_provider',
            value: newProvider,
            description: 'Active payment gateway provider',
            data_type: 'string',
            updated_by: adminUserId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key' },
        );

      if (error) {
        log.error('Failed to update payment provider in DB', error);
        return { success: false, message: 'Failed to update database' };
      }

      this.clearCache();

      await logAudit({
        userId: adminUserId,
        action: 'update',
        description: `Switched payment provider from ${previousProvider} to ${newProvider}`,
        entityType: 'config',
        entityId: 'payment_provider',
        changes: { provider: { from: previousProvider, to: newProvider } },
      });

      log.info(`Payment provider switched: ${previousProvider} -> ${newProvider} by ${adminUserId}`);

      return { success: true, message: `Payment provider switched to ${newProvider}` };
    } catch (error) {
      log.error('Error switching payment provider', error);
      return { success: false, message: 'An error occurred while switching providers' };
    }
  }

  /**
   * Get status of all providers (for admin dashboard).
   */
  async getProviderStatus(): Promise<PaymentProviderStatus[]> {
    const activeProvider = await this.getActiveProviderName();

    return (Object.keys(this.providers) as PaymentProviderName[]).map((name) => ({
      name,
      enabled: true,
      isActive: activeProvider === name,
      configured: this.isProviderConfigured(name),
    }));
  }

  // 
  // Payment Operations (delegate to active provider)
  // 

  /**
   * Create a payment order via the active provider.
   */
  async createOrder(data: {
    amount: number;
    currency: string;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<PaymentOrder & { provider: PaymentProviderName }> {
    const providerName = await this.getActiveProviderName();
    const provider = this.providers[providerName];
    const order = await provider.createOrder(data);
    return { ...order, provider: providerName };
  }

  /**
   * Fetch payment details by gateway payment ID.
   */
  async fetchPayment(paymentId: string, providerHint?: PaymentProviderName): Promise<any> {
    const provider = providerHint ? this.providers[providerHint] : await this.getActiveProvider();
    return provider.fetchPayment(paymentId);
  }

  /**
   * Fetch order status by order ID (normalized across providers).
   */
  async fetchOrderStatus(orderId: string, providerHint?: PaymentProviderName): Promise<PaymentOrderStatus> {
    const provider = providerHint ? this.providers[providerHint] : await this.getActiveProvider();
    return provider.fetchOrderStatus(orderId);
  }

  /**
   * Create a refund against a payment.
   */
  async createRefund(
    paymentId: string,
    data: { amount?: number; speed?: 'normal' | 'optimum'; notes?: Record<string, string> },
    providerHint?: PaymentProviderName,
  ): Promise<PaymentRefund> {
    const provider = providerHint ? this.providers[providerHint] : await this.getActiveProvider();
    return provider.createRefund(paymentId, data);
  }

  /**
   * Verify checkout payment signature (Razorpay HMAC / Cashfree order fetch).
   */
  async verifySignature(data: any, providerHint?: PaymentProviderName): Promise<boolean> {
    const provider = providerHint ? this.providers[providerHint] : await this.getActiveProvider();
    if (provider.verifySignature) {
      return provider.verifySignature(data);
    }
    return true;
  }

  /**
   * Verify webhook signature from a provider.
   */
  verifyWebhookSignature(
    payload: string | Buffer,
    signature: string,
    providerHint: PaymentProviderName,
  ): boolean {
    const provider = this.providers[providerHint];
    if (provider.verifyWebhookSignature) {
      return provider.verifyWebhookSignature(payload, signature);
    }
    return false;
  }

  /**
   * Parse a webhook body into a normalized event.
   */
  parseWebhookEvent(body: any, providerHint: PaymentProviderName): WebhookEvent {
    const provider = this.providers[providerHint];
    if (provider.parseWebhookEvent) {
      return provider.parseWebhookEvent(body);
    }
    return { type: 'unknown', data: {} };
  }
}

export const paymentService = new PaymentService();
