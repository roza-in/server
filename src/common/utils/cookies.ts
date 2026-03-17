import { env } from '../../config/env.js';
import { Request, Response } from 'express';

const ACCESS_COOKIE = 'rozx_access';
const REFRESH_COOKIE = 'rozx_refresh';

export type TokenPair = {
  accessToken: string | null;
  refreshToken: string | null;
};

/**
 * Get cookie domain for cross-subdomain auth
 * Returns the COOKIE_DOMAIN if set (for local or production subdomain auth)
 * Returns undefined if not set (cookies work on current domain only)
 */
function getCookieDomain(): string | undefined {
  // Use COOKIE_DOMAIN if set (supports both local and production subdomain auth)
  const domain = env.COOKIE_DOMAIN;

  if (domain) {
    // Strip port if present (just in case)
    return domain.split(':')[0];
  }

  return undefined;
}

const isProduction = env.NODE_ENV === 'production';

/**
 * Shared cookie options to guarantee set/clear use identical flags.
 * Browsers ignore clearCookie if the flags don't match what was set.
 */
function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,      // Must be 'lax' (not 'strict') — SameSite=Strict cookies are NOT
                                    // sent after cross-site redirect chains (Google → Supabase → app),
                                    // which breaks the entire OAuth flow. 'lax' sends cookies on
                                    // top-level GET navigations, which is exactly what OAuth needs.
    path: '/',
    domain: getCookieDomain(),
  };
}

export function setTokenCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
  opts?: { maxAgeSeconds?: number; refreshMaxAgeSeconds?: number; secure?: boolean; sameSite?: 'lax' | 'strict' | 'none' },
) {
  const accessMaxAge = (opts?.maxAgeSeconds ?? 60 * 60) * 1000; // default 1 hour in ms
  const refreshMaxAge = (opts?.refreshMaxAgeSeconds ?? 60 * 60 * 24 * 30) * 1000; // default 30 days in ms

  const base = baseCookieOptions();

  // Allow per-call overrides (e.g. OAuth cross-domain flow may need 'lax')
  const secure = opts?.secure ?? base.secure;
  const sameSite = opts?.sameSite ?? base.sameSite;

  res.cookie(ACCESS_COOKIE, accessToken, {
    ...base,
    secure,
    sameSite,
    maxAge: accessMaxAge,
  });

  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...base,
    secure,
    sameSite,
    maxAge: refreshMaxAge,
  });
}

/**
 * Clear auth cookies — flags MUST match those used in `setTokenCookies`
 * or the browser will silently ignore the clear instruction.
 */
export function clearTokenCookies(res: Response) {
  const base = baseCookieOptions();

  res.clearCookie(ACCESS_COOKIE, base);
  res.clearCookie(REFRESH_COOKIE, base);
}

export function getTokensFromReq(req: Request): TokenPair {
  const cookies = (req as any).cookies ?? {};
  const accessToken = cookies[ACCESS_COOKIE] ?? null;
  const refreshToken = cookies[REFRESH_COOKIE] ?? null;
  return { accessToken, refreshToken };
}

export { ACCESS_COOKIE, REFRESH_COOKIE };
