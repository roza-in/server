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
import { VideoProvider, VideoTokenPayload } from './video.types.js';


const { RtcTokenBuilder, RtcRole } = agoraAccessToken;

const log = logger.child('AgoraProvider');

/**
 * Agora Video Provider Implementation
 */
export class AgoraProvider implements VideoProvider {
    name = 'agora';
    private appId: string;
    private appCertificate: string;

    constructor() {
        this.appId = env.AGORA_APP_ID || '';
        this.appCertificate = env.AGORA_APP_CERTIFICATE || '';

        if (!this.appId || !this.appCertificate) {
            log.warn('Agora credentials not configured - AGORA_APP_ID and AGORA_APP_CERTIFICATE required');
        }
    }

    /**
     * Check if provider is properly configured
     */
    isConfigured(): boolean {
        return !!(this.appId && this.appCertificate);
    }

    /**
     * Generate RTC token for video calls
     * 
     * @param payload Token parameters including roomId, userId, role
     * @returns Promise<string> The generated Agora RTC token
     */
    async generateToken(payload: VideoTokenPayload): Promise<string> {
        if (!this.isConfigured()) {
            throw new Error('Agora credentials not configured. Set AGORA_APP_ID and AGORA_APP_CERTIFICATE.');
        }

        const { roomId, userId, role = 'host', expirationInSeconds = 3600 } = payload;

        // Calculate expiration timestamp
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const privilegeExpiredTs = currentTimestamp + expirationInSeconds;

        // Map role to Agora RTC role
        const rtcRole = role === 'host' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

        try {
            // Use buildTokenWithAccount for string user IDs (UUID support)
            const token = RtcTokenBuilder.buildTokenWithAccount(
                this.appId,
                this.appCertificate,
                roomId,
                userId,
                rtcRole,
                privilegeExpiredTs
            );

            log.debug('Generated Agora RTC token', {
                roomId,
                userId,
                role,
                expiresIn: expirationInSeconds
            });

            return token;
        } catch (error) {
            log.error('Agora token generation failed', {
                error: error instanceof Error ? error.message : String(error),
                roomId,
                userId
            });
            throw new Error('Failed to generate Agora token');
        }
    }

    /**
     * Generate numeric UID from string userId (for clients that require numeric UID)
     */
    generateNumericUid(userId: string): number {
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            const char = userId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash) % 2147483647 + 1;
    }

    /**
     * Get client configuration for Agora SDK initialization
     */
    getClientConfig(): { appId: string } {
        return { appId: this.appId };
    }
}
