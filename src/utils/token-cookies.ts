import { Request, Response } from 'express';

const ACCESS_COOKIE = 'rozx_access';
const REFRESH_COOKIE = 'rozx_refresh';

export type TokenPair = {
  accessToken: string | null;
  refreshToken: string | null;
};

export function setTokenCookies(res: Response, accessToken: string, refreshToken: string, opts?: { maxAgeSeconds?: number; secure?: boolean; sameSite?: 'lax' | 'strict' | 'none' }) {
  const maxAge = (opts?.maxAgeSeconds ?? 60 * 60 * 24 * 7) * 1000; // default 7 days in ms
  const secure = opts?.secure ?? process.env.NODE_ENV === 'production';
  const sameSite = opts?.sameSite ?? 'lax';

  // HttpOnly, Secure cookies set by the server
  res.cookie(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge,
  });

  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge,
  });
}

export function clearTokenCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_COOKIE, { path: '/' });
}

export function getTokensFromReq(req: Request): TokenPair {
  const cookies = (req as any).cookies ?? {};
  const accessToken = cookies[ACCESS_COOKIE] ?? null;
  const refreshToken = cookies[REFRESH_COOKIE] ?? null;
  return { accessToken, refreshToken };
}

export { ACCESS_COOKIE, REFRESH_COOKIE };
