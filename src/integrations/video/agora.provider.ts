/**
 * Agora RTC Provider
 *
 * Generates RTC tokens for Agora video calls.
 * Uses the agora-access-token package for secure token generation.
 *
 * @see https://docs.agora.io/en/video-calling/develop/authentication-workflow
 */

import agoraAccessToken from 'agora-access-token';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import type { VideoProvider, VideoTokenPayload } from './video.types.js';

const { RtcTokenBuilder, RtcRole } = agoraAccessToken;
const log = logger.child('AgoraProvider');

export class AgoraProvider implements VideoProvider {
  readonly name = 'agora' as const;
  private appId: string;
  private appCertificate: string;

  constructor() {
    this.appId = env.AGORA_APP_ID || '';
    this.appCertificate = env.AGORA_APP_CERTIFICATE || '';

    if (!this.isConfigured()) {
      log.warn('Agora credentials not configured — AGORA_APP_ID and AGORA_APP_CERTIFICATE required');
    }
  }

  isConfigured(): boolean {
    return !!(this.appId && this.appCertificate);
  }

  /**
   * Generate RTC token for video calls.
   * Uses `buildTokenWithAccount` for UUID-based user IDs.
   */
  async generateToken(payload: VideoTokenPayload): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Agora credentials not configured. Set AGORA_APP_ID and AGORA_APP_CERTIFICATE.');
    }

    const { roomId, userId, role = 'host', expirationInSeconds = 3600 } = payload;
    const privilegeExpiredTs = Math.floor(Date.now() / 1000) + expirationInSeconds;
    const rtcRole = role === 'host' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

    try {
      const token = RtcTokenBuilder.buildTokenWithAccount(
        this.appId,
        this.appCertificate,
        roomId,
        userId,
        rtcRole,
        privilegeExpiredTs,
      );

      log.debug('Generated Agora RTC token', { roomId, userId, role, expiresIn: expirationInSeconds });
      return token;
    } catch (error) {
      log.error('Agora token generation failed', {
        error: error instanceof Error ? error.message : String(error),
        roomId,
        userId,
      });
      throw new Error('Failed to generate Agora token');
    }
  }

  getClientConfig(): { appId: string } {
    return { appId: this.appId };
  }
}
