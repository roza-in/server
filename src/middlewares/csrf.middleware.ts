import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../common/errors/index.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const CSRF_COOKIE = 'rozx_csrf';
const CSRF_HEADER = 'x-csrf-token';
const CSRF_TOKEN_LENGTH = 32;

/**
 * State-changing HTTP methods that require CSRF validation
 */
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Generate a cryptographically secure CSRF token
 */
export const generateCsrfToken = (): string => {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
};

/**
 * CSRF Protection Middleware — Double-Submit Cookie Pattern
 *
 * How it works:
 * 1. On GET requests (or any safe method), if no CSRF cookie exists, one is set.
 * 2. On unsafe methods (POST, PUT, PATCH, DELETE), the middleware validates that
 *    the X-CSRF-Token header matches the rozx_csrf cookie.
 * 3. Cross-origin attackers cannot read the cookie value (SameSite + HttpOnly=false
 *    so JS can read it) to send in the header, preventing CSRF.
 *
 * Skip conditions:
 * - Webhook endpoints (they use HMAC verification instead)
 * - Non-production environments can optionally bypass (controlled by env)
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF for webhook endpoints (authenticated via HMAC signatures)
  if (req.path.includes('/webhook')) {
    return next();
  }

  // Skip CSRF for API key-authenticated requests (machine-to-machine)
  if (req.headers.authorization?.startsWith('Bearer api_')) {
    return next();
  }

  // For safe methods: ensure CSRF cookie is set for subsequent unsafe requests
  if (!UNSAFE_METHODS.has(req.method)) {
    if (!req.cookies?.[CSRF_COOKIE]) {
      const token = generateCsrfToken();
      res.cookie(CSRF_COOKIE, token, {
        httpOnly: false, // Must be readable by JavaScript to send in header
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        domain: env.COOKIE_DOMAIN?.split(':')[0] || undefined,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });
    }
    return next();
  }

  // For unsafe methods: validate the CSRF token
  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER] as string | undefined;

  if (!cookieToken || !headerToken) {
    logger.warn('CSRF validation failed: missing token', {
      hasCookie: !!cookieToken,
      hasHeader: !!headerToken,
      method: req.method,
      path: req.path,
    });
    throw new ForbiddenError('CSRF token missing. Please refresh and try again.');
  }

  // Constant-time comparison to prevent timing attacks
  if (cookieToken.length !== headerToken.length ||
      !crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
    logger.warn('CSRF validation failed: token mismatch', {
      method: req.method,
      path: req.path,
    });
    throw new ForbiddenError('CSRF token invalid. Please refresh and try again.');
  }

  next();
};

/**
 * Endpoint to get a CSRF token — useful for SPAs that need to bootstrap the token.
 * GET /api/v1/auth/csrf-token
 */
export const getCsrfToken = (req: Request, res: Response) => {
  let token = req.cookies?.[CSRF_COOKIE];

  if (!token) {
    token = generateCsrfToken();
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      domain: env.COOKIE_DOMAIN?.split(':')[0] || undefined,
      maxAge: 24 * 60 * 60 * 1000,
    });
  }

  res.json({ success: true, data: { csrfToken: token } });
};
