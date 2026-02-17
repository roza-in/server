/**
 * Storage Integration Types
 *
 * Wraps Supabase Storage operations with typed results.
 * Supports 'public' and 'private' buckets.
 */

// ── Bucket names ────────────────────────────────────────────────────────────
export type StorageBucket = 'public' | 'private';

// ── Upload result ───────────────────────────────────────────────────────────
export interface UploadResult {
  /** Storage path within the bucket (e.g. avatars/user-123/timestamp-uuid-file.png) */
  path: string;
  /** Public URL (only set for 'public' bucket uploads) */
  publicUrl?: string;
  /** Bucket the file was uploaded to */
  bucket: StorageBucket;
}

// ── Signed URL ──────────────────────────────────────────────────────────────
export interface SignedUrlResult {
  signedUrl: string;
  /** Expiry time in seconds */
  expiresIn: number;
  path: string;
}

// ── Upload options ──────────────────────────────────────────────────────────
export interface UploadOptions {
  /** Target folder (e.g. 'avatars/user-123') */
  folder: string;
  /** Original filename (will be sanitized) */
  filename: string;
  /** File content */
  buffer: Buffer;
  /** MIME type (defaults to 'application/octet-stream') */
  contentType?: string;
  /** Overwrite existing file at same path (default: false) */
  upsert?: boolean;
}
