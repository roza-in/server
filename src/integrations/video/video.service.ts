/**
 * Video Service (Integration Layer)
 *
 * Orchestrates video providers (Agora, ZegoCloud) with environment-driven
 * active provider selection and credential-based fallback.
 *
 * Features:
 *  - Dynamic provider resolution (env → first configured)
 *  - Token generation + channel name helpers
 *  - Numeric UID generation for providers that require it
 *  - Client config for frontend SDK initialization
 */

import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import type {
  VideoProvider,
  VideoTokenPayload,
  VideoProviderName,
  VideoProviderStatus,
  VideoClientConfig,
} from './video.types.js';
import { AgoraProvider } from './agora.provider.js';
import { ZegoCloudProvider } from './zegocloud.provider.js';

const log = logger.child('VideoService');

class VideoService {
  private providers: Record<VideoProviderName, VideoProvider>;
  private cachedActiveProvider: VideoProviderName | null = null;
  private cacheExpiry = 0;
  private readonly CACHE_TTL_MS = 5 * 60_000; // 5 minutes

  constructor() {
    this.providers = {
      agora: new AgoraProvider(),
      zegocloud: new ZegoCloudProvider(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Provider Resolution
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get the currently active video provider name.
   * Priority: cache → ENV VIDEO_PROVIDER → first configured → 'agora' (default)
   */
  async getActiveProviderName(): Promise<VideoProviderName> {
    if (this.cachedActiveProvider && Date.now() < this.cacheExpiry) {
      return this.cachedActiveProvider;
    }

    // 1. Environment variable
    const envProvider = (env.VIDEO_PROVIDER || '').toLowerCase() as VideoProviderName;
    if (this.providers[envProvider]?.isConfigured()) {
      this.setCache(envProvider);
      return envProvider;
    }

    // 2. First configured provider
    if (this.providers.agora.isConfigured()) {
      this.setCache('agora');
      return 'agora';
    }
    if (this.providers.zegocloud.isConfigured()) {
      this.setCache('zegocloud');
      return 'zegocloud';
    }

    // 3. Fallback — no provider configured
    log.error('No video provider is properly configured');
    return 'agora';
  }

  /**
   * Get the active video provider instance.
   */
  async getActiveProvider(): Promise<VideoProvider> {
    const name = await this.getActiveProviderName();
    return this.providers[name];
  }

  private setCache(provider: VideoProviderName): void {
    this.cachedActiveProvider = provider;
    this.cacheExpiry = Date.now() + this.CACHE_TTL_MS;
  }

  clearCache(): void {
    this.cachedActiveProvider = null;
    this.cacheExpiry = 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Provider Status
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get status of all providers (for admin dashboard).
   */
  async getProviderStatus(): Promise<VideoProviderStatus[]> {
    const activeProvider = await this.getActiveProviderName();

    return (Object.keys(this.providers) as VideoProviderName[]).map((name) => ({
      name,
      enabled: true,
      isActive: activeProvider === name,
      configured: this.providers[name].isConfigured(),
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Token Generation
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate a video token using the active provider.
   */
  async generateToken(
    params: VideoTokenPayload,
  ): Promise<{ token: string; provider: VideoProviderName }> {
    const providerName = await this.getActiveProviderName();
    const provider = this.providers[providerName];

    if (!provider.isConfigured()) {
      log.error('Active video provider is not configured', { provider: providerName });
      throw new Error(`Video provider ${providerName} is not configured`);
    }

    log.debug('Generating video token', { provider: providerName, roomId: params.roomId, userId: params.userId });

    try {
      const token = await provider.generateToken(params);
      return { token, provider: providerName };
    } catch (error) {
      log.error('Token generation failed', {
        provider: providerName,
        error: error instanceof Error ? error.message : error,
        roomId: params.roomId,
      });
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate a deterministic channel name for a consultation.
   */
  generateChannelName(consultationId: string): string {
    return `rozx_call_${consultationId.replace(/-/g, '')}`;
  }

  /**
   * Generate a numeric UID from a UUID.
   * Required by providers like Agora that use numeric UIDs.
   * Returns a positive 32-bit integer.
   */
  generateUserUid(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return (Math.abs(hash) % 2147483647) + 1;
  }

  /**
   * Get client configuration for frontend SDK initialization.
   */
  async getClientConfig(): Promise<VideoClientConfig> {
    const providerName = await this.getActiveProviderName();
    const provider = this.providers[providerName];
    const { appId } = provider.getClientConfig();
    return { provider: providerName, appId };
  }
}

export const videoService = new VideoService();
