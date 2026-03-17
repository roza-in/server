/**
 * ZegoCloud Video Provider
 *
 * Generates Token04 for ZegoCloud video calls using native crypto.
 * Self-contained implementation — no external SDK dependency.
 *
 * @see https://docs.zegocloud.com/article/16309
 */

import crypto from 'crypto';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import type { VideoProvider, VideoTokenPayload } from './video.types.js';

const log = logger.child('ZegoCloudProvider');

export class ZegoCloudProvider implements VideoProvider {
  readonly name = 'zegocloud' as const;
  private appId: number;
  private serverSecret: string;

  constructor() {
    this.appId = env.ZEGOCLOUD_APP_ID || 0;
    this.serverSecret = env.ZEGOCLOUD_SERVER_SECRET || env.ZEGOCLOUD_APP_SIGN || '';

    if (!this.isConfigured()) {
      log.warn('ZegoCloud credentials not configured — ZEGOCLOUD_APP_ID and ZEGOCLOUD_SERVER_SECRET required');
    }
  }

  isConfigured(): boolean {
    return !!(this.appId && this.serverSecret);
  }

  async generateToken(payload: VideoTokenPayload): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('ZegoCloud credentials not configured. Set ZEGOCLOUD_APP_ID and ZEGOCLOUD_SERVER_SECRET.');
    }

    const { roomId, userId, expirationInSeconds = 3600 } = payload;

    try {
      const privilege = { 1: 1, 2: 1 }; // loginRoom + publishStream
      const payloadData = {
        room_id: roomId,
        privilege,
        stream_id_list: null,
      };

      const token = generateToken04(
        this.appId,
        userId,
        this.serverSecret,
        expirationInSeconds,
        JSON.stringify(payloadData),
      );

      log.debug('Generated ZegoCloud token', { roomId, userId, expiresIn: expirationInSeconds });
      return token;
    } catch (error) {
      log.error('ZegoCloud token generation failed', {
        error: error instanceof Error ? error.message : String(error),
        roomId,
        userId,
      });
      throw new Error('Failed to generate ZegoCloud token');
    }
  }

  getClientConfig(): { appId: number } {
    return { appId: this.appId };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Zego Token04 Generation (self-contained, no SDK)
// Ref: Official Zego Server Assistant logic adapted for Node.js
// ═══════════════════════════════════════════════════════════════════════════════

function generateToken04(
  appId: number,
  userId: string,
  secret: string,
  effectiveTimeInSeconds: number,
  payload?: string,
): string {
  if (!appId || !userId || !secret) {
    throw new Error('Invalid token generation parameters');
  }

  const version = 4;
  const createTime = Math.floor(Date.now() / 1000);
  const expireTime = createTime + effectiveTimeInSeconds;
  const nonce = parseInt(crypto.randomBytes(8).toString('hex').substring(0, 14), 16);

  const tokenInfo = JSON.stringify({
    app_id: appId,
    user_id: userId,
    nonce,
    ctime: createTime,
    expire: expireTime,
    payload: payload || '',
  });

  // IV: 16 random bytes
  const iv = crypto.randomBytes(16);

  // Key derivation: AES-128-CBC requires exactly 16 bytes
  const key = deriveKey(secret);

  // Encrypt
  const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(tokenInfo, 'utf8'), cipher.final()]);

  // Pack: [Version:1][IvLen:2][Iv:16][EncLen:2][Encrypted:N]
  const bVersion = Buffer.alloc(1);
  bVersion.writeUInt8(version, 0);

  const bIvLen = Buffer.alloc(2);
  bIvLen.writeUInt16BE(iv.length, 0);

  const bEncLen = Buffer.alloc(2);
  bEncLen.writeUInt16BE(encrypted.length, 0);

  return Buffer.concat([bVersion, bIvLen, iv, bEncLen, encrypted]).toString('base64');
}

/**
 * Derive a 16-byte AES key from the Zego secret.
 *
 * Handles multiple secret formats:
 *  - 32 hex chars (standard ServerSecret) → decode as hex (16 bytes)
 *  - 64 hex chars (AppSign) → decode as hex, take first 16 bytes
 *  - Other → treat as UTF-8, pad/truncate to 16 bytes
 */
function deriveKey(secret: string): Buffer {
  if (secret.length === 32 && /^[0-9a-fA-F]{32}$/.test(secret)) {
    return Buffer.from(secret, 'hex');
  }

  if (secret.length === 64 && /^[0-9a-fA-F]{64}$/.test(secret)) {
    return Buffer.from(secret, 'hex').subarray(0, 16);
  }

  // Raw string — pad or truncate to 16 bytes
  const raw = Buffer.from(secret, 'utf8');
  if (raw.length >= 16) return raw.subarray(0, 16);

  const padded = Buffer.alloc(16);
  raw.copy(padded);
  return padded;
}
