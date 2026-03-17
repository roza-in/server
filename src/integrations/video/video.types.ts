/**
 * Video Integration Types
 *
 * Supports multiple providers (Agora, ZegoCloud) via a common interface.
 * Active provider is admin-switchable via VIDEO_PROVIDER env.
 */

// ── Provider names ──────────────────────────────────────────────────────────
export type VideoProviderName = 'agora' | 'zegocloud';

// ── Token payload ───────────────────────────────────────────────────────────
export interface VideoTokenPayload {
  roomId: string;
  userId: string;
  role?: 'host' | 'audience';
  expirationInSeconds?: number;
}

// ── Client config (returned to frontend for SDK init) ───────────────────────
export interface VideoClientConfig {
  provider: VideoProviderName;
  appId: string | number;
}

// ── Provider interface ──────────────────────────────────────────────────────
export interface VideoProvider {
  readonly name: VideoProviderName;

  /** Generate an RTC token for video calls */
  generateToken(payload: VideoTokenPayload): Promise<string>;

  /** Check if the provider has its required credentials configured */
  isConfigured(): boolean;

  /** Return the client-side app ID for SDK initialization */
  getClientConfig(): { appId: string | number };

  /** Optionally create a room resource on the provider side */
  createRoom?(roomId: string): Promise<any>;
}

// ── Provider status (admin dashboard) ───────────────────────────────────────
export interface VideoProviderStatus {
  name: VideoProviderName;
  enabled: boolean;
  isActive: boolean;
  configured: boolean;
}

// ── Room session info ───────────────────────────────────────────────────────
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

// ── Video call events ───────────────────────────────────────────────────────
export type VideoCallEvent =
  | 'call_initiated'
  | 'call_accepted'
  | 'call_rejected'
  | 'call_ended'
  | 'participant_joined'
  | 'participant_left'
  | 'call_failed';

