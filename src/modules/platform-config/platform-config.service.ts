import { supabaseAdmin } from '../../database/supabase-admin.js';
import { logger } from '../../config/logger.js';
import { BadRequestError, NotFoundError } from '../../common/errors/index.js';
import { cacheGetOrSet, cacheInvalidate, CacheKeys, CacheTTL } from '../../config/redis.js';

/**
 * Platform Config Service - Single source of truth for system settings
 * Handles configuration from the `platform_config` table with in-memory caching.
 */
class PlatformConfigService {
    private supabase = supabaseAdmin;
    private log = logger.child('PlatformConfigService');

    /**
     * Get all platform settings
     */
    async getSettings() {
        return cacheGetOrSet(
            CacheKeys.platformConfig(),
            async () => {
                const { data, error } = await this.supabase.from('platform_config').select('*');
                if (error) {
                    this.log.error('Failed to fetch settings from DB', error);
                    throw new BadRequestError('Failed to fetch settings');
                }
                return data || [];
            },
            CacheTTL.PLATFORM_CONFIG,
        );
    }

    /**
     * Get a specific setting by key
     */
    async getSetting(key: string) {
        return cacheGetOrSet(
            CacheKeys.platformConfigKey(key),
            async () => {
                const { data, error } = await this.supabase
                    .from('platform_config')
                    .select('*')
                    .eq('config_key', key)
                    .single();
                if (error || !data) {
                    throw new NotFoundError('Setting not found');
                }
                return data;
            },
            CacheTTL.PLATFORM_CONFIG,
        );
    }

    /**
     * Get configuration value directly by key
     */
    async getConfigValue<T>(key: string, defaultValue: T): Promise<T> {
        try {
            const setting = await this.getSetting(key);
            return (setting.config_value as T) ?? defaultValue;
        } catch {
            // Setting not found in DB — silently return default.
            // This is expected for optional config keys (e.g. rate limits).
            return defaultValue;
        }
    }

    /**
     * Update a platform setting
     */
    async updateSetting(key: string, value: any, updatedBy?: string) {
        // 1. Get previous value for audit trail (if needed by DB logic or triggers)
        // 2. Perform upsert
        const { data, error } = await this.supabase
            .from('platform_config')
            .upsert({
                config_key: key,
                config_value: value,
                updated_by: updatedBy,
                updated_at: new Date().toISOString(),
            } as any)
            .select()
            .single();

        if (error) {
            this.log.error(`Failed to update setting: ${key}`, error);
            throw new BadRequestError('Failed to update setting');
        }

        // 3. Clear relevant caches
        await Promise.all([
            cacheInvalidate(CacheKeys.platformConfig()),
            cacheInvalidate(CacheKeys.platformConfigKey(key)),
        ]);

        this.log.info(`Setting updated: ${key}`, { key, value, updatedBy });
        return data;
    }

    /**
     * Reset/Delete a custom setting (defaults to DB defaults if fallback exists)
     */
    async resetSetting(key: string) {
        const { error } = await this.supabase
            .from('platform_config')
            .delete()
            .eq('config_key', key);

        if (error) {
            this.log.error(`Failed to reset setting: ${key}`, error);
            throw new BadRequestError('Failed to reset setting');
        }

        await Promise.all([
            cacheInvalidate(CacheKeys.platformConfig()),
            cacheInvalidate(CacheKeys.platformConfigKey(key)),
        ]);

        return { reset: true };
    }

    // --- Specialized Business Logic Helpers ---

    /**
     * Get consultation commission percentage
     * @param hospitalId Optional hospital ID for specific override
     */
    async getCommissionRate(hospitalId?: string): Promise<number> {
        if (hospitalId) {
            const rates = await this.getHospitalRates(hospitalId);
            return Number(rates.platform_commission_percent);
        }
        const rate = await this.getConfigValue('consultation_commission_percent', 8);
        return Number(rate);
    }

    /**
     * Get medicine commission percentage
     * @param hospitalId Optional hospital ID for specific override
     */
    async getMedicineCommissionRate(hospitalId?: string): Promise<number> {
        if (hospitalId) {
            const rates = await this.getHospitalRates(hospitalId);
            return Number(rates.medicine_commission_percent);
        }
        const rate = await this.getConfigValue('medicine_commission_percent', 5);
        return Number(rate);
    }

    /**
     * Get medicine delivery fee
     */
    async getDeliveryFee(): Promise<number> {
        const fee = await this.getConfigValue('delivery_fee', 40);
        return Number(fee);
    }

    /**
     * Get platform cancellation/refund policy
     */
    async getCancellationPolicy() {
        return this.getConfigValue('cancellation_policy', {
            free_hours: 4,
            partial_after_hours: 24,
            partial_percent: 50
        });
    }

    /**
     * Get platform GST rate
     */
    async getGSTRate(): Promise<number> {
        const rate = await this.getConfigValue('gst_rate', 18);
        return Number(rate);
    }

    /**
     * Get minimum payout amount for settlements
     */
    async getMinPayoutAmount(): Promise<number> {
        const amount = await this.getConfigValue('min_payout_amount', 500);
        return Number(amount);
    }

    /**
     * Get payment timeout in minutes
     */
    async getPaymentTimeout(): Promise<number> {
        const timeout = await this.getConfigValue('payment_timeout_minutes', 15);
        return Number(timeout);
    }

    /**
     * Get OTP configuration
     */
    async getOTPSettings() {
        return {
            expiry_minutes: await this.getConfigValue('otp_expiry_minutes', 10),
            length: await this.getConfigValue('otp_length', 6),
            max_attempts: await this.getConfigValue('otp_max_attempts', 3),
        };
    }

    /**
     * Get Rate Limit configuration
     */
    async getRateLimitSettings() {
        return {
            window_ms: await this.getConfigValue('rate_limit_window_ms', 60000),
            max_requests: await this.getConfigValue('rate_limit_max_requests', 100),
        };
    }

    /**
     * Get commission rates for a specific hospital (with fallback to platform defaults)
     */
    async getHospitalRates(hospitalId: string) {
        return cacheGetOrSet(
            CacheKeys.hospitalConfig(hospitalId),
            async () => {
                const { data: hospital, error } = await this.supabase
                    .from('hospitals')
                    .select(`
                        platform_commission_percent, 
                        medicine_commission_percent, 
                        commission_slab_id,
                        commission_slabs (
                            consultation_commission_percent,
                            medicine_commission_percent
                        )
                    `)
                    .eq('id', hospitalId)
                    .single();

                // 1. Get Global Defaults as base
                const [globalPlatformComm, globalMedicineComm] = await Promise.all([
                    this.getConfigValue('consultation_commission_percent', 8),
                    this.getConfigValue('medicine_commission_percent', 5)
                ]);

                if (error || !hospital) {
                    if (error && error.code !== 'PGRST116') { // PGRST116 is NotFound
                        this.log.error(`Error fetching hospital rates: ${hospitalId}`, error);
                    }
                    return {
                        platform_commission_percent: globalPlatformComm,
                        medicine_commission_percent: globalMedicineComm
                    };
                }

                const slab = hospital.commission_slabs as any;

                // 2. Hierarchical Resolution
                // Priority 1: Hospital Override (non-null in DB)
                // Priority 2: Slab Rate (if connected)
                // Priority 3: Global Default

                const platform_commission_percent = hospital.platform_commission_percent !== null
                    ? Number(hospital.platform_commission_percent)
                    : Number(slab?.consultation_commission_percent ?? globalPlatformComm);

                const medicine_commission_percent = hospital.medicine_commission_percent !== null
                    ? Number(hospital.medicine_commission_percent)
                    : Number(slab?.medicine_commission_percent ?? globalMedicineComm);

                return {
                    platform_commission_percent,
                    medicine_commission_percent
                };
            },
            CacheTTL.PLATFORM_CONFIG
        );
    }
}

export const platformConfigService = new PlatformConfigService();
