import { z } from 'zod';
// import { supabaseAdmin } from '../../database/supabase-admin.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { logAudit } from '../../config/audit.js';
import { ERROR_CODES } from '../../common/errors/error-codes.js';
import {
    VideoProvider,
    VideoTokenPayload,
    VideoProviderName,
    VideoProviderStatus,
    VideoProviderNameSchema
} from './video.types.js';
import { AgoraProvider } from './agora.provider.js';
import { ZegoCloudProvider } from './zegocloud.provider.js';

const log = logger.child('VideoService');

/**
 * Validation Schemas
 */
const TokenParamsSchema = z.object({
    roomId: z.string().min(3).max(100),
    userId: z.string().uuid(),
    role: z.enum(['host', 'audience']).default('host'),
    expirationInSeconds: z.number().int().min(300).max(86400).default(3600),
});

const SwitchProviderSchema = z.object({
    newProvider: VideoProviderNameSchema,
    adminUserId: z.string().uuid(),
});

/**
 * Video Service
 * 
 * Orchestrates video providers (Agora, ZegoCloud) with admin-switchable
 * active provider support via database (system_settings) and environment variables.
 */
class VideoService {
    private providers: Record<VideoProviderName, VideoProvider>;
    private cachedActiveProvider: VideoProviderName | null = null;
    private cacheExpiry = 0;
    private readonly CACHE_TTL_MS = 5 * 60 * 1000; // Increased to 5 minutes for production

    constructor() {
        // Initialize providers
        this.providers = {
            agora: new AgoraProvider(),
            zegocloud: new ZegoCloudProvider()
        };
    }

    /**
     * Get the currently active video provider name
     * Checks database first, falls back to env, defaults to configured provider
     */
    async getActiveProviderName(): Promise<VideoProviderName> {
        // 1. Check Environment Variable
        const envProvider = (env.VIDEO_PROVIDER || '').toLowerCase() as VideoProviderName;
        if (this.providers[envProvider]?.isConfigured()) {
            return envProvider;
        }

        // 2. Fallback logic based on credentials
        if (this.providers['agora'].isConfigured()) {
            return 'agora';
        }

        if (this.providers['zegocloud'].isConfigured()) {
            return 'zegocloud';
        }

        // Critical: No provider configured
        log.error('No video provider is properly configured in production environment');
        return 'agora'; // Default fallback
    }

    private setCache(provider: VideoProviderName) {
        this.cachedActiveProvider = provider;
        this.cacheExpiry = Date.now() + this.CACHE_TTL_MS;
    }

    /**
     * Get the active video provider instance
     */
    async getActiveProvider(): Promise<VideoProvider> {
        const name = await this.getActiveProviderName();
        return this.providers[name];
    }

    /**
     * Switch the active video provider (admin action)
     * 
     * @param newProvider The provider to switch to
     * @param adminUserId The ID of the admin performing the switch
     */
    async switchProvider(newProvider: VideoProviderName, adminUserId: string): Promise<{ success: boolean; message: string }> {
        return { success: false, message: 'Provider switching via API is disabled. Use environment variables.' };
    }

    /**
     * Get status of all providers
     */
    async getProviderStatus(): Promise<VideoProviderStatus[]> {
        const activeProvider = await this.getActiveProviderName();

        return (Object.keys(this.providers) as VideoProviderName[]).map(name => ({
            name,
            enabled: true,
            isActive: activeProvider === name,
            configured: this.providers[name].isConfigured(),
        }));
    }

    /**
     * Generate token using the active provider
     * 
     * @param params Token generation parameters
     */
    async generateToken(params: { roomId: string; userId: string; role?: 'host' | 'audience'; expirationInSeconds?: number }): Promise<{ token: string; provider: VideoProviderName }> {
        // Validate parameters
        const validation = TokenParamsSchema.safeParse(params);
        if (!validation.success) {
            log.warn('Token generation requested with invalid parameters', { errors: validation.error.format(), params });
            throw new Error('Invalid token parameters');
        }

        const validParams = validation.data;
        const providerName = await this.getActiveProviderName();
        const provider = this.providers[providerName];

        if (!provider.isConfigured()) {
            log.error('Active video provider is not configured', { provider: providerName });
            throw new Error(`Video provider ${providerName} is not configured`);
        }

        log.debug('Generating video token', {
            provider: providerName,
            roomId: validParams.roomId,
            userId: validParams.userId
        });

        try {
            const token = await provider.generateToken({
                roomId: validParams.roomId,
                userId: validParams.userId,
                role: validParams.role,
                expirationInSeconds: validParams.expirationInSeconds
            });

            return { token, provider: providerName };
        } catch (error) {
            log.error('Token generation failed at provider level', {
                provider: providerName,
                error: error instanceof Error ? error.message : error,
                params: validParams
            });
            throw error;
        }
    }

    /**
     * Generate channel name for a consultation
     * 
     * @param consultationId The internal consultation UUID
     */
    generateChannelName(consultationId: string): string {
        // Ensure consistency across platforms
        return `rozx_call_${consultationId.replace(/-/g, '')}`;
    }

    /**
     * Generate unique numeric UID for a user in a channel
     * Required by some providers like Agora (for numeric UID clients)
     * 
     * @param userId The User UUID
     * @returns A 32-bit unsigned integer
     */
    generateUserUid(userId: string): number {
        // Implementation uses a more robust hashing for 32-bit range
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            const char = userId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        // Ensure strictly positive and within 32-bit unsigned range (max 4,294,967,295)
        // Using 2,147,483,647 as max for signed-safe operations in some JDks
        return (Math.abs(hash) % 2147483647) + 1;
    }

    /**
     * Get client configuration for SDK initialization
     */
    async getClientConfig(): Promise<{ provider: VideoProviderName; appId: string | number }> {
        const providerName = await this.getActiveProviderName();
        const instance = this.providers[providerName];

        // Safely extract appId from provider instance
        const appId = (instance as any).appId || (instance as any).getClientConfig?.().appId || '';

        return { provider: providerName, appId };
    }

    /**
     * Clear the provider cache
     */
    clearCache(): void {
        this.cachedActiveProvider = null;
        this.cacheExpiry = 0;
    }
}

export const videoService = new VideoService();
