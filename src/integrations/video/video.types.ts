import { z } from 'zod';

/**
 * Token generation payload
 */
export interface VideoTokenPayload {
    roomId: string;
    userId: string;
    role?: 'host' | 'audience';
    expirationInSeconds?: number;
}

/**
 * Available video provider names
 */
export const VideoProviderNameSchema = z.enum(['agora', 'zegocloud']);
export type VideoProviderName = z.infer<typeof VideoProviderNameSchema>;

/**
 * Video provider interface
 */
export interface VideoProvider {
    name: string;
    generateToken(payload: VideoTokenPayload): Promise<string>;
    createRoom?(roomId: string): Promise<any>;
    isConfigured(): boolean;
}

/**
 * Provider status for health checks/admin
 */
export interface VideoProviderStatus {
    name: VideoProviderName;
    enabled: boolean;
    isActive: boolean;
    configured: boolean;
}

/**
 * Room session info
 */
export interface VideoRoomSession {
    roomId: string;
    channelName: string;
    consultationId: string;
    doctorUserId: string;
    patientUserId: string;
    doctorToken?: string;
    patientToken?: string;
    provider: VideoProviderName;
    createdAt: string;
    expiresAt: string;
}

/**
 * Video call events
 */
export type VideoCallEvent =
    | 'call_initiated'
    | 'call_accepted'
    | 'call_rejected'
    | 'call_ended'
    | 'participant_joined'
    | 'participant_left'
    | 'call_failed';
