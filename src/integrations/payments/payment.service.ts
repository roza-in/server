/**
 * Payment Service
 * 
 * Orchestrates payment providers (Razorpay, PhonePe) with admin-switchable
 * active provider support via database (system_settings) and environment variables.
 * 
 * Features:
 * - Dynamic provider switching (admin-switchable)
 * - Result caching (TTL-based)
 * - Audit logging for configuration changes
 * - Fallback to environment variables
 */

import { supabaseAdmin } from '../../database/supabase-admin.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { logAudit } from '../../config/audit.js';
import {
    PaymentProvider,
    PaymentOrder,
    PaymentRefund,
    PaymentProviderName,
    PaymentProviderStatus
} from './payment.types.js';
import { RazorpayProvider } from './razorpay/razorpay.provider.js';
import { CashfreeProvider } from './cashfree/cashfree.provider.js';


const log = logger.child('PaymentService');

class PaymentService {
    private providers: Record<PaymentProviderName, PaymentProvider>;
    private cachedActiveProvider: PaymentProviderName | null = null;
    private cacheExpiry = 0;
    private readonly CACHE_TTL_MS = 60 * 1000; // 1 minute

    constructor() {
        // Initialize providers
        this.providers = {
            razorpay: new RazorpayProvider(),
            cashfree: new CashfreeProvider()
        };
    }

    /**
     * Get the currently active payment provider name
     * Checks database first, falls back to env, defaults to phonepe
     */
    async getActiveProviderName(): Promise<PaymentProviderName> {
        // Check cache
        if (this.cachedActiveProvider && Date.now() < this.cacheExpiry) {
            return this.cachedActiveProvider;
        }

        try {
            // 1. Check Database Settings
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
        } catch (err) {
            log.warn('Failed to fetch payment settings from DB, falling back to ENV', err);
        }

        // 2. Check Environment Variable
        const envProvider = (env.PAYMENT_PROVIDER || 'cashfree').toLowerCase() as PaymentProviderName;
        if (this.providers[envProvider] && this.isProviderConfigured(envProvider)) {
            this.setCache(envProvider);
            return envProvider;
        }

        // 3. Absolute default
        const defaultProvider = this.isProviderConfigured('cashfree') ? 'cashfree' : 'razorpay';
        this.setCache(defaultProvider);
        return defaultProvider;
    }

    /**
     * Internal check if provider is configured
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

    private setCache(provider: PaymentProviderName) {
        this.cachedActiveProvider = provider;
        this.cacheExpiry = Date.now() + this.CACHE_TTL_MS;
    }

    /**
     * Get the active payment provider instance
     */
    async getActiveProvider(): Promise<PaymentProvider> {
        const name = await this.getActiveProviderName();
        return this.providers[name];
    }

    /**
     * Switch the active payment provider (admin action)
     */
    async switchProvider(newProvider: PaymentProviderName, adminUserId: string): Promise<{ success: boolean; message: string }> {
        if (!this.providers[newProvider]) {
            return { success: false, message: `Invalid provider: ${newProvider}` };
        }

        if (!this.isProviderConfigured(newProvider)) {
            return {
                success: false,
                message: `Provider ${newProvider} is not configured. Please set the required environment variables.`
            };
        }

        try {
            const previousProvider = await this.getActiveProviderName();

            // Upsert to system_settings
            const { error } = await supabaseAdmin
                .from('system_settings')
                .upsert({
                    key: 'payment_provider',
                    value: newProvider,
                    description: 'Active payment gateway provider',
                    data_type: 'string',
                    updated_by: adminUserId,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'key' });

            if (error) {
                log.error('Failed to update payment provider', error);
                return { success: false, message: 'Failed to update database' };
            }

            // Clear cache
            this.clearCache();

            // Audit log
            await logAudit({
                userId: adminUserId,
                action: 'admin.config_change',
                actionDescription: `Switched payment provider from ${previousProvider} to ${newProvider}`,
                entityType: 'config',
                entityId: 'payment_provider',
                oldData: { provider: previousProvider },
                newData: { provider: newProvider },
            });

            log.info(`Payment provider switched from ${previousProvider} to ${newProvider} by admin ${adminUserId}`);

            return {
                success: true,
                message: `Payment provider switched to ${newProvider} successfully`
            };
        } catch (error) {
            log.error('Error switching payment provider', error);
            return { success: false, message: 'An error occurred while switching providers' };
        }
    }

    /**
     * Get status of all providers
     */
    async getProviderStatus(): Promise<PaymentProviderStatus[]> {
        const activeProvider = await this.getActiveProviderName();

        return (Object.keys(this.providers) as PaymentProviderName[]).map(name => ({
            name,
            enabled: true,
            isActive: activeProvider === name,
            configured: this.isProviderConfigured(name),
        }));
    }

    /**
     * Create payment order using active provider
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
     * Fetch payment details
     */
    async fetchPayment(paymentId: string, providerHint?: PaymentProviderName): Promise<any> {
        const provider = providerHint ? this.providers[providerHint] : await this.getActiveProvider();
        return provider.fetchPayment(paymentId);
    }

    /**
     * Create refund
     */
    async createRefund(
        paymentId: string,
        data: { amount?: number; speed?: 'normal' | 'optimum'; notes?: Record<string, string> },
        providerHint?: PaymentProviderName
    ): Promise<PaymentRefund> {
        const provider = providerHint ? this.providers[providerHint] : await this.getActiveProvider();
        return provider.createRefund(paymentId, data);
    }

    /**
     * Verify payment signature
     */
    async verifySignature(data: any, providerHint?: PaymentProviderName): Promise<boolean> {
        const provider = providerHint ? this.providers[providerHint] : await this.getActiveProvider();
        if (provider.verifySignature) {
            return provider.verifySignature(data);
        }
        return true;
    }

    /**
     * Clear the provider cache
     */
    clearCache(): void {
        this.cachedActiveProvider = null;
        this.cacheExpiry = 0;
    }
}

export const paymentService = new PaymentService();
