import crypto from 'crypto';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { VideoProvider, VideoTokenPayload } from './video.types.js';

const log = logger.child('ZegoCloudProvider');

/**
 * ZegoCloud Video Provider Implementation using zego-server-assistant logic
 */
export class ZegoCloudProvider implements VideoProvider {
    name = 'zegocloud';
    private appId: number;
    private serverSecret: string;

    constructor() {
        this.appId = env.ZEGOCLOUD_APP_ID || 0;
        this.serverSecret = env.ZEGOCLOUD_SERVER_SECRET || env.ZEGOCLOUD_APP_SIGN || '';

        if (!this.appId || !this.serverSecret) {
            log.warn('ZegoCloud credentials not configured - ZEGOCLOUD_APP_ID and ZEGOCLOUD_SERVER_SECRET required');
        } else {
            // DEBUG: Log Secret Info
            const len = this.serverSecret.length;
            const isHex = /^[0-9a-fA-F]+$/.test(this.serverSecret);
            log.info('--> DEBUG: Zego Secret Loaded', {
                appId: this.appId,
                length: len,
                isHex,
                first4: this.serverSecret.substring(0, 4)
            });
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
            // Correct Payload Structure for Privilege
            // Zego requires integer keys for privilege levels
            const privilege = {
                1: 1, // loginRoom
                2: 1  // publishStream
            };

            const payloadData = {
                room_id: roomId,
                privilege: privilege,
                stream_id_list: null // null implies no restrictions
            };

            const token = generateToken04(
                this.appId,
                userId,
                this.serverSecret,
                expirationInSeconds,
                JSON.stringify(payloadData)
            );

            log.debug('Generated ZegoCloud token', { roomId, userId, expiresIn: expirationInSeconds });
            return token;
        } catch (error) {
            log.error('ZegoCloud token generation failed', { error: String(error), roomId, userId });
            throw new Error('Failed to generate ZegoCloud token');
        }
    }

    getClientConfig(): { appId: number } {
        return { appId: this.appId };
    }
}

// -------------------------------------------------------------------------------------------------
// Zego Token 04 Implementation
// Ref: Official Zego Server Assistant logic adapted for Node.js
// -------------------------------------------------------------------------------------------------

function generateToken04(appId: number, userId: string, secret: string, effectiveTimeInSeconds: number, payload?: string): string {
    if (!appId || !userId || !secret) {
        throw new Error('invalid param');
    }

    const version = 4; // Token04
    const createTime = Math.floor(new Date().getTime() / 1000);
    const expireTime = createTime + effectiveTimeInSeconds;

    // Nonce: Use secure random number
    const nonce = parseInt(crypto.randomBytes(8).toString('hex').substring(0, 14), 16);

    const tokenInfo = {
        app_id: appId,
        user_id: userId,
        nonce: nonce,
        ctime: createTime,
        expire: expireTime,
        payload: payload || ''
    };

    const plainText = JSON.stringify(tokenInfo);

    // IV: 16 Random Bytes
    const iv = crypto.randomBytes(16);

    // Key Derivation: STRICT AES-128-CBC (16 bytes key)
    let key: Buffer;
    if (secret.length === 32 && /^[0-9a-fA-F]{32}$/.test(secret)) {
        // Standard Zego Secret (32 hex chars -> 16 bytes)
        key = Buffer.from(secret, 'hex');
    } else if (secret.length === 64 && /^[0-9a-fA-F]{64}$/.test(secret)) {
        // AppSign (64 hex chars -> 32 bytes). 
        // Token04 uses AES-128, so we MUST use 16 bytes.
        // We take the first 16 bytes of the decoded AppSign.
        key = Buffer.from(secret, 'hex').subarray(0, 16);
    } else {
        // Raw string secret? Treat as UTF8
        key = Buffer.from(secret, 'utf8');
    }

    // Ensure strictly 16 bytes for AES-128
    if (key.length > 16) {
        key = key.subarray(0, 16);
    } else if (key.length < 16) {
        const padded = Buffer.alloc(16);
        key.copy(padded);
        key = padded;
    }

    // Debug Log (Do not log full secret in production, but helpful for debugging)
    console.log(`[ZegoToken] Generating... AppID: ${appId}, SecretLen: ${secret.length}, KeyLen: ${key.length}, IVLen: ${iv.length}`);

    // Encrypt
    const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
    let encrypted = cipher.update(plainText, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    // Pack: [Version:1][IvLen:2][Iv:N][EncLen:2][Encrypted:M]
    const bVersion = Buffer.alloc(1);
    bVersion.writeUInt8(version, 0);

    const bIvLen = Buffer.alloc(2);
    bIvLen.writeUInt16BE(iv.length, 0);

    const bEncLen = Buffer.alloc(2);
    bEncLen.writeUInt16BE(encrypted.length, 0);

    const result = Buffer.concat([bVersion, bIvLen, iv, bEncLen, encrypted]);
    return result.toString('base64');
}

function makeNonce(): number {
    return Math.floor(Math.random() * 2147483647);
}

function makeRandomIv(): Buffer {
    const str = '0123456789abcdefghijklmnopqrstuvwxyz';
    const result = [];
    for (let i = 0; i < 16; i++) {
        const r = Math.floor(Math.random() * str.length);
        result.push(str.charAt(r));
    }
    return Buffer.from(result.join(''));
}
