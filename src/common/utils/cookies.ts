import { env } from '@/config/env.js';
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

export function setTokenCookies(res: Response, accessToken: string, refreshToken: string, opts?: { maxAgeSeconds?: number; refreshMaxAgeSeconds?: number; secure?: boolean; sameSite?: 'lax' | 'strict' | 'none' }) {
  const accessMaxAge = (opts?.maxAgeSeconds ?? 60 * 60) * 1000; // default 1 hour in ms
  const refreshMaxAge = (opts?.refreshMaxAgeSeconds ?? 60 * 60 * 24 * 30) * 1000; // default 30 days in ms
  const isProduction = env.NODE_ENV === 'production';

  // Secure cookies require HTTPS. Local dev is HTTP, so must be false.
  const secure = opts?.secure ?? isProduction;
  const sameSite = opts?.sameSite ?? 'lax';
  const domain = getCookieDomain();

  // HttpOnly, Secure cookies set by the server
  // Domain is set for cross-subdomain auth in production
  res.cookie(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: accessMaxAge,
    domain, // Enables cookie sharing across *.rozx.in
  });

  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: refreshMaxAge,
    domain, // Enables cookie sharing across *.rozx.in
  });
}

export function clearTokenCookies(res: Response) {
  const domain = getCookieDomain();

  res.clearCookie(ACCESS_COOKIE, { path: '/', domain });
  res.clearCookie(REFRESH_COOKIE, { path: '/', domain });
}

export function getTokensFromReq(req: Request): TokenPair {
  const cookies = (req as any).cookies ?? {};
  const accessToken = cookies[ACCESS_COOKIE] ?? null;
  const refreshToken = cookies[REFRESH_COOKIE] ?? null;
  return { accessToken, refreshToken };
}

export { ACCESS_COOKIE, REFRESH_COOKIE };
