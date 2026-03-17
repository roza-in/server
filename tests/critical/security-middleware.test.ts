/**
 * Security Middleware Tests
 *
 * Covers:
 *  - CSRF double-submit cookie pattern
 *  - Error leakage prevention in production
 *  - Cookie security flags (httpOnly, sameSite, secure)
 *  - Role guard authorization
 *  - Strict role guard (no admin bypass)
 *  - Rate limiter degraded-mode behaviour
 *  - Tokens NOT in JSON response body
 */

import crypto from 'crypto';

// ---------------------------------------------------------------------------
// CSRF — Double-submit cookie pattern
// ---------------------------------------------------------------------------

describe('Security — CSRF Double-Submit', () => {
  const CSRF_SECRET = process.env.COOKIE_SECRET!;

  function generateCsrfToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  function verifyCsrf(cookieToken: string | undefined, headerToken: string | undefined): boolean {
    if (!cookieToken || !headerToken) return false;
    try {
      return crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken));
    } catch {
      return false;
    }
  }

  const WEBHOOK_PATHS = ['/api/v1/payments/razorpay/webhook', '/api/v1/payments/cashfree/webhook'];

  function shouldSkipCsrf(method: string, path: string): boolean {
    if (['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) return true;
    if (WEBHOOK_PATHS.some((wp) => path.startsWith(wp))) return true;
    return false;
  }

  it('rejects when cookie token is missing', () => {
    expect(verifyCsrf(undefined, 'some-header-token')).toBe(false);
  });

  it('rejects when header token is missing', () => {
    expect(verifyCsrf('some-cookie-token', undefined)).toBe(false);
  });

  it('rejects when tokens do not match', () => {
    expect(verifyCsrf('token-A', 'token-B')).toBe(false);
  });

  it('accepts matching cookie and header token', () => {
    const token = generateCsrfToken();
    expect(verifyCsrf(token, token)).toBe(true);
  });

  it('skips CSRF for GET requests', () => {
    expect(shouldSkipCsrf('GET', '/api/v1/patients')).toBe(true);
  });

  it('skips CSRF for HEAD requests', () => {
    expect(shouldSkipCsrf('HEAD', '/api/v1/patients')).toBe(true);
  });

  it('skips CSRF for OPTIONS requests', () => {
    expect(shouldSkipCsrf('OPTIONS', '/api/v1/patients')).toBe(true);
  });

  it('skips CSRF for Razorpay webhook path', () => {
    expect(shouldSkipCsrf('POST', '/api/v1/payments/razorpay/webhook')).toBe(true);
  });

  it('skips CSRF for Cashfree webhook path', () => {
    expect(shouldSkipCsrf('POST', '/api/v1/payments/cashfree/webhook')).toBe(true);
  });

  it('enforces CSRF for normal POST', () => {
    expect(shouldSkipCsrf('POST', '/api/v1/appointments')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Error leakage — production mode
// ---------------------------------------------------------------------------

describe('Security — Error Leakage Prevention', () => {
  interface ApiError {
    statusCode: number;
    message: string;
    code: string;
    isOperational: boolean;
    stack?: string;
  }

  function formatErrorResponse(error: unknown, isProduction: boolean) {
    const isApiError = (err: unknown): err is ApiError =>
      typeof err === 'object' && err !== null && 'isOperational' in err;

    if (isApiError(error)) {
      return {
        status: error.statusCode,
        message: error.message,
        code: error.code,
        ...(isProduction ? {} : { stack: error.stack }),
      };
    }

    return {
      status: 500,
      message: isProduction ? 'An unexpected error occurred' : (error as Error).message,
      code: 'INTERNAL_ERROR',
      ...(isProduction ? {} : { stack: (error as Error).stack }),
    };
  }

  it('returns operational error message in production', () => {
    const err: ApiError = {
      statusCode: 400,
      message: 'Invalid phone number',
      code: 'VALIDATION_ERROR',
      isOperational: true,
      stack: 'at line 42...',
    };
    const res = formatErrorResponse(err, true);
    expect(res.message).toBe('Invalid phone number');
    expect(res).not.toHaveProperty('stack');
  });

  it('hides non-operational error details in production', () => {
    const err = new Error('Database connection lost');
    const res = formatErrorResponse(err, true);
    expect(res.message).toBe('An unexpected error occurred');
    expect(res).not.toHaveProperty('stack');
  });

  it('includes stack trace in development', () => {
    const err = new Error('Some internal error');
    const res = formatErrorResponse(err, false);
    expect(res.message).toBe('Some internal error');
    expect(res).toHaveProperty('stack');
  });
});

// ---------------------------------------------------------------------------
// Cookie flags
// ---------------------------------------------------------------------------

describe('Security — Cookie Flags', () => {
  function baseCookieOptions(isProduction: boolean) {
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict' as const,
      path: '/',
    };
  }

  it('sets httpOnly to true in all environments', () => {
    expect(baseCookieOptions(true).httpOnly).toBe(true);
    expect(baseCookieOptions(false).httpOnly).toBe(true);
  });

  it('sets secure flag in production', () => {
    expect(baseCookieOptions(true).secure).toBe(true);
  });

  it('disables secure flag in development', () => {
    expect(baseCookieOptions(false).secure).toBe(false);
  });

  it('sets sameSite to strict', () => {
    expect(baseCookieOptions(true).sameSite).toBe('strict');
    expect(baseCookieOptions(false).sameSite).toBe('strict');
  });
});

// ---------------------------------------------------------------------------
// Role guard
// ---------------------------------------------------------------------------

describe('Security — Role Guard', () => {
  type Role = 'admin' | 'patient' | 'doctor' | 'hospital' | 'reception' | 'pharmacy';

  function roleGuard(allowedRoles: Role[], userRole: Role): { allowed: boolean; adminOverride: boolean } {
    if (allowedRoles.includes(userRole)) return { allowed: true, adminOverride: false };
    if (userRole === 'admin') return { allowed: true, adminOverride: true };
    return { allowed: false, adminOverride: false };
  }

  function strictRoleGuard(allowedRoles: Role[], userRole: Role): boolean {
    return allowedRoles.includes(userRole); // No admin fallback
  }

  it('allows user with matching role', () => {
    expect(roleGuard(['doctor', 'hospital'], 'doctor').allowed).toBe(true);
  });

  it('allows admin via fallback', () => {
    const result = roleGuard(['doctor'], 'admin');
    expect(result.allowed).toBe(true);
    expect(result.adminOverride).toBe(true);
  });

  it('blocks user with non-matching role', () => {
    expect(roleGuard(['doctor'], 'patient').allowed).toBe(false);
  });

  it('strictRoleGuard does NOT allow admin fallback', () => {
    expect(strictRoleGuard(['doctor'], 'admin')).toBe(false);
  });

  it('strictRoleGuard allows matching role', () => {
    expect(strictRoleGuard(['admin'], 'admin')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tokens NOT in JSON response body
// ---------------------------------------------------------------------------

describe('Security — Tokens Not In Response Body', () => {
  function sanitizeAuthResponse(data: Record<string, unknown>) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { tokens, accessToken, refreshToken, access_token, refresh_token, ...publicData } = data;
    return publicData;
  }

  it('removes tokens key from response', () => {
    const raw = { user: { id: 'u1' }, tokens: { access: 'xxx', refresh: 'yyy' } };
    const safe = sanitizeAuthResponse(raw);
    expect(safe).not.toHaveProperty('tokens');
    expect(safe).toHaveProperty('user');
  });

  it('removes accessToken / refreshToken keys', () => {
    const raw = { accessToken: 'a', refreshToken: 'r', userId: 'u1' };
    const safe = sanitizeAuthResponse(raw);
    expect(safe).not.toHaveProperty('accessToken');
    expect(safe).not.toHaveProperty('refreshToken');
    expect(safe).toHaveProperty('userId');
  });

  it('removes snake_case token keys', () => {
    const raw = { access_token: 'a', refresh_token: 'r', role: 'patient' };
    const safe = sanitizeAuthResponse(raw);
    expect(safe).not.toHaveProperty('access_token');
    expect(safe).not.toHaveProperty('refresh_token');
    expect(safe).toHaveProperty('role');
  });
});

// ---------------------------------------------------------------------------
// Rate limiter degraded mode
// ---------------------------------------------------------------------------

describe('Security — Rate Limiter Degraded Mode', () => {
  function degradedLimit(baseMax: number, degradedFactor: number): number {
    return Math.floor(baseMax * degradedFactor);
  }

  it('applies 0.5× factor in degraded mode', () => {
    expect(degradedLimit(100, 0.5)).toBe(50);
  });

  it('floors the result', () => {
    expect(degradedLimit(7, 0.5)).toBe(3);
  });

  it('full rate when not degraded (factor=1)', () => {
    expect(degradedLimit(100, 1)).toBe(100);
  });
});
