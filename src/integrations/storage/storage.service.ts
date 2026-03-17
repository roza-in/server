/**
 * Storage Service (Integration Layer)
 *
 * Wraps Supabase Storage with typed helpers for public/private buckets.
 * All modules should use this instead of calling supabaseAdmin.storage directly.
 *
 * Features:
 *  - Public uploads (returns public URL)
 *  - Private uploads (signed URL on demand)
 *  - Delete files
 *  - Signed URL generation with configurable expiry
 */

import crypto from 'crypto';
import { supabaseAdmin } from '../../database/supabase-admin.js';
import { logger } from '../../config/logger.js';
import type { StorageBucket, UploadResult, SignedUrlResult, UploadOptions } from './storage.types.js';

const log = logger.child('StorageService');

class StorageService {
  // ═══════════════════════════════════════════════════════════════════════════
  // Path Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generates a unique, collision-safe storage path.
   * Format: {folder}/{timestamp}-{uuid}-{sanitized-filename}
   */
  private makePath(folder: string, filename: string): string {
    const id = crypto.randomUUID();
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
    return `${folder}/${Date.now()}-${id}-${safeName}`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Upload
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Upload a file to the public bucket. Returns the public URL.
   */
  async uploadPublic(opts: UploadOptions): Promise<UploadResult> {
    const bucket: StorageBucket = 'public';
    const path = this.makePath(opts.folder, opts.filename);

    const { data, error } = await supabaseAdmin.storage.from(bucket).upload(path, opts.buffer, {
      contentType: opts.contentType || 'application/octet-stream',
      upsert: opts.upsert ?? false,
    });

    if (error || !data) {
      log.error('Public upload failed', { bucket, path, error });
      throw new Error('Upload failed');
    }

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);

    return { path, publicUrl, bucket };
  }

  /**
   * Upload a file to the private bucket. No public URL is returned.
   */
  async uploadPrivate(opts: UploadOptions): Promise<UploadResult> {
    const bucket: StorageBucket = 'private';
    const path = this.makePath(opts.folder, opts.filename);

    const { data, error } = await supabaseAdmin.storage.from(bucket).upload(path, opts.buffer, {
      contentType: opts.contentType || 'application/octet-stream',
      upsert: opts.upsert ?? false,
    });

    if (error || !data) {
      log.error('Private upload failed', { bucket, path, error });
      throw new Error('Upload failed');
    }

    return { path, bucket };
  }

  /**
   * Upload to either bucket based on the `bucket` parameter.
   */
  async upload(bucket: StorageBucket, opts: UploadOptions): Promise<UploadResult> {
    return bucket === 'public' ? this.uploadPublic(opts) : this.uploadPrivate(opts);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Signed URLs
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate a signed URL for a file in any bucket.
   * Default expiry: 1 hour (3600 seconds).
   */
  async createSignedUrl(
    bucket: StorageBucket,
    path: string,
    expiresInSec = 3600,
  ): Promise<SignedUrlResult> {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSec);

    if (error || !data) {
      log.error('createSignedUrl failed', { bucket, path, error });
      throw new Error('Failed to generate signed URL');
    }

    return { signedUrl: data.signedUrl, expiresIn: expiresInSec, path };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Delete
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Delete one or more files from a bucket.
   */
  async deleteFiles(bucket: StorageBucket, paths: string[]): Promise<void> {
    if (paths.length === 0) return;

    const { error } = await supabaseAdmin.storage.from(bucket).remove(paths);

    if (error) {
      log.error('deleteFiles failed', { bucket, paths, error });
      throw new Error('Failed to delete files');
    }
  }

  /**
   * Delete a single file from a bucket.
   */
  async deleteFile(bucket: StorageBucket, path: string): Promise<void> {
    return this.deleteFiles(bucket, [path]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Public URL
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get the public URL for a file in the public bucket.
   */
  getPublicUrl(path: string): string {
    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from('public').getPublicUrl(path);
    return publicUrl;
  }
}

export const storageService = new StorageService();
