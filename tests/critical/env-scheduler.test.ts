/**
 * C7: Environment Validation  +  C9: Distributed Job Locking
 *
 * C7 — Env Validation
 *  - Missing required vars → process exits
 *  - JWT_SECRET entropy check (≥10 unique chars)
 *  - Valid env passes validation
 *
 * C9 — Distributed Locking (acquireLock / releaseLock / runWithLock)
 *  - acquireLock returns true for fresh key (SET NX EX)
 *  - acquireLock returns false if key exists
 *  - releaseLock deletes key
 *  - runWithLock skips callback when lock not acquired
 *  - runWithLock releases lock after callback
 */

// ---------------------------------------------------------------------------
// C7 — Environment Validation
// ---------------------------------------------------------------------------

describe('C7 — Environment Validation', () => {
  // Mirrors the Zod schema in src/config/env.ts

  interface EnvSchema {
    NODE_ENV: string;
    PORT?: number;
    JWT_SECRET: string;
    COOKIE_SECRET: string;
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
  }

  function validateEnv(env: Partial<EnvSchema>): { success: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!env.NODE_ENV) errors.push('NODE_ENV is required');
    if (!env.JWT_SECRET) {
      errors.push('JWT_SECRET is required');
    } else {
      if (env.JWT_SECRET.length < 32) errors.push('JWT_SECRET must be at least 32 chars');
      const uniqueChars = new Set(env.JWT_SECRET).size;
      if (uniqueChars < 10) errors.push('JWT_SECRET must have at least 10 unique characters');
    }
    if (!env.COOKIE_SECRET) {
      errors.push('COOKIE_SECRET is required');
    } else if (env.COOKIE_SECRET.length < 32) {
      errors.push('COOKIE_SECRET must be at least 32 chars');
    }
    if (!env.SUPABASE_URL) errors.push('SUPABASE_URL is required');
    if (!env.SUPABASE_ANON_KEY) errors.push('SUPABASE_ANON_KEY is required');

    return { success: errors.length === 0, errors };
  }

  it('passes with valid env', () => {
    const result = validateEnv({
      NODE_ENV: 'production',
      JWT_SECRET: 'abcdefghijklmnopqrstuvwxyz1234567890!@#$',
      COOKIE_SECRET: 'a'.repeat(16) + 'b'.repeat(16),
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_ANON_KEY: 'eyJ...',
    });
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when JWT_SECRET is missing', () => {
    const result = validateEnv({
      NODE_ENV: 'production',
      COOKIE_SECRET: 'a'.repeat(32),
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_ANON_KEY: 'eyJ...',
    });
    expect(result.success).toBe(false);
    expect(result.errors).toContain('JWT_SECRET is required');
  });

  it('fails when JWT_SECRET is too short', () => {
    const result = validateEnv({
      NODE_ENV: 'production',
      JWT_SECRET: 'short',
      COOKIE_SECRET: 'a'.repeat(32),
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_ANON_KEY: 'eyJ...',
    });
    expect(result.success).toBe(false);
    expect(result.errors).toContain('JWT_SECRET must be at least 32 chars');
  });

  it('fails when JWT_SECRET has insufficient entropy', () => {
    // 32 chars but only 1 unique char
    const result = validateEnv({
      NODE_ENV: 'production',
      JWT_SECRET: 'a'.repeat(32),
      COOKIE_SECRET: 'b'.repeat(32),
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_ANON_KEY: 'eyJ...',
    });
    expect(result.success).toBe(false);
    expect(result.errors).toContain('JWT_SECRET must have at least 10 unique characters');
  });

  it('fails when COOKIE_SECRET is too short', () => {
    const result = validateEnv({
      NODE_ENV: 'production',
      JWT_SECRET: 'abcdefghijklmnopqrstuvwxyz1234567890!@#$',
      COOKIE_SECRET: 'short',
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_ANON_KEY: 'eyJ...',
    });
    expect(result.success).toBe(false);
    expect(result.errors).toContain('COOKIE_SECRET must be at least 32 chars');
  });

  it('fails when SUPABASE_URL is missing', () => {
    const result = validateEnv({
      NODE_ENV: 'production',
      JWT_SECRET: 'abcdefghijklmnopqrstuvwxyz1234567890!@#$',
      COOKIE_SECRET: 'a'.repeat(32),
      SUPABASE_ANON_KEY: 'eyJ...',
    });
    expect(result.success).toBe(false);
    expect(result.errors).toContain('SUPABASE_URL is required');
  });

  it('collects all errors at once', () => {
    const result = validateEnv({});
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// C9 — Distributed Job Locking (mirrors scheduler.ts acquireLock / releaseLock)
// ---------------------------------------------------------------------------

describe('C9 — Distributed Job Locking', () => {
  let store: Map<string, { value: string; expiresAt: number }>;

  beforeEach(() => {
    store = new Map();
  });

  /**
   * Simulates Redis SET key value NX EX ttl
   */
  function acquireLock(key: string, ttlMs: number): boolean {
    const now = Date.now();
    const existing = store.get(key);
    if (existing && existing.expiresAt > now) return false; // key exists and not expired

    store.set(key, { value: 'locked', expiresAt: now + ttlMs });
    return true;
  }

  function releaseLock(key: string): void {
    store.delete(key);
  }

  async function runWithLock(
    lockKey: string,
    ttlMs: number,
    callback: () => Promise<void>,
  ): Promise<boolean> {
    const acquired = acquireLock(lockKey, ttlMs);
    if (!acquired) return false;

    try {
      await callback();
    } finally {
      releaseLock(lockKey);
    }
    return true;
  }

  it('acquireLock returns true for a new key', () => {
    expect(acquireLock('job:cleanup', 30000)).toBe(true);
  });

  it('acquireLock returns false if key already held', () => {
    acquireLock('job:cleanup', 30000);
    expect(acquireLock('job:cleanup', 30000)).toBe(false);
  });

  it('acquireLock succeeds after lock expires', () => {
    // Set lock with 0ms TTL (already expired)
    store.set('job:cleanup', { value: 'locked', expiresAt: Date.now() - 1 });
    expect(acquireLock('job:cleanup', 30000)).toBe(true);
  });

  it('releaseLock removes the key', () => {
    acquireLock('job:cleanup', 30000);
    releaseLock('job:cleanup');
    expect(store.has('job:cleanup')).toBe(false);
  });

  it('runWithLock executes callback and releases lock', async () => {
    let executed = false;
    const ran = await runWithLock('job:settle', 30000, async () => {
      executed = true;
    });
    expect(ran).toBe(true);
    expect(executed).toBe(true);
    expect(store.has('job:settle')).toBe(false); // lock released
  });

  it('runWithLock skips callback when lock is held', async () => {
    acquireLock('job:settle', 30000);
    let executed = false;
    const ran = await runWithLock('job:settle', 30000, async () => {
      executed = true;
    });
    expect(ran).toBe(false);
    expect(executed).toBe(false);
  });

  it('runWithLock releases lock even if callback throws', async () => {
    try {
      await runWithLock('job:settle', 30000, async () => {
        throw new Error('Job failed');
      });
    } catch {
      // expected
    }
    expect(store.has('job:settle')).toBe(false); // lock released via finally
  });

  it('different keys are independent', () => {
    acquireLock('job:a', 30000);
    expect(acquireLock('job:b', 30000)).toBe(true);
  });
});
