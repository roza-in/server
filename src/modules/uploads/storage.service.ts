import { supabaseAdmin } from '@/database/supabase-admin.js';
import { logger } from '../../config/logger.js';
import crypto from 'crypto';

/**
 * Storage Service - helper wrappers around Supabase Storage for uploads
 * - Uses service role client (admin)
 * - Provides small helpers: ensureBucket, uploadBuffer, getPublicUrl, createSignedUrl
 */
export class StorageService {
  private supabase = supabaseAdmin;

  private makePath(prefix: string, filename: string) {
    const id = crypto.randomUUID();
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
    return `${prefix}/${Date.now()}-${id}-${safeName}`;
  }

  async ensureBucket(bucket: string, isPublic = true) {
    try {
      const { data, error } = await this.supabase.storage.getBucket(bucket);
      if (error || !data) {
        await this.supabase.storage.createBucket(bucket, { public: isPublic });
        logger.info('Created storage bucket', { bucket });
      }
    } catch (err) {
      // ignore - bucket may already exist or insufficient permissions
      logger.debug('ensureBucket error', { bucket, err });
    }
  }

  async uploadBuffer(bucket: string, prefix: string, filename: string, buffer: Buffer, contentType?: string) {
    await this.ensureBucket(bucket);
    const path = this.makePath(prefix, filename);

    const { data, error } = await this.supabase.storage.from(bucket).upload(path, buffer, {
      contentType: contentType || 'application/octet-stream',
      upsert: false,
    } as any);

    if (error || !data) {
      logger.error('Storage upload failed', { bucket, path, error });
      throw new Error('Upload failed');
    }

    // Public URL (works if bucket is public)
    const { data: pub } = this.supabase.storage.from(bucket).getPublicUrl(path);
    return {
      path,
      publicUrl: pub?.publicUrl || null,
    };
  }

  async createSignedUrl(bucket: string, path: string, expiresSec = 60 * 60) {
    const { data, error } = await this.supabase.storage.from(bucket).createSignedUrl(path, expiresSec);
    if (error) {
      logger.error('createSignedUrl failed', { bucket, path, error });
      throw error;
    }
    return data.signedUrl;
  }
}

export const storageService = new StorageService();

