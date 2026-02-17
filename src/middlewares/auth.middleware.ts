import { Request, Response, NextFunction } from 'express';
import { AuthError } from '../common/errors/index.js';
import { verifyToken, extractTokenFromHeader } from '../common/utils/jwt.js';
import { getTokensFromReq } from '../common/utils/cookies.js';
import { TokenPayload } from '../types/jwt.js';
import { getRedisClient } from '../config/redis.js';
import { securityService } from '../config/security.js';

/**
 * Validate that a session is still active.
 * Uses Redis cache with 60s TTL to avoid hitting DB on every request.
 */
const isSessionActive = async (sessionId: string): Promise<boolean> => {
  if (!sessionId) return false;

  const redis = getRedisClient();
  const cacheKey = `session:active:${sessionId}`;

  // Check Redis cache first
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached === 'valid') return true;
      if (cached === 'invalid') return false;
    } catch {
      // Redis failure — fall through to DB
    }
  }

  // Check DB
  const valid = await securityService.isSessionValid(sessionId);

  // Cache result for 60 seconds
  if (redis) {
    try {
      await redis.setex(cacheKey, 60, valid ? 'valid' : 'invalid');
    } catch {
      // Non-fatal
    }
  }

  return valid;
};

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Extract token from Header or Cookie
    let token = extractTokenFromHeader(req.headers.authorization);

    // If no header token, check cookies
    if (!token) {
      const { accessToken } = getTokensFromReq(req);
      token = accessToken;
    }

    if (!token) {
      throw new AuthError('Missing authentication token');
    }

    // 2. Verify Token
    try {
      const decoded = verifyToken(token) as TokenPayload;

      // 3. Validate session is still active (C3 fix)
      if (decoded.sessionId) {
        const sessionValid = await isSessionActive(decoded.sessionId);
        if (!sessionValid) {
          throw new AuthError('Session has been revoked or expired', 'SESSION_INVALID');
        }
      }

      // 4. Populate req.user (matches AuthUser interface)
      (req as any).user = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        sessionId: decoded.sessionId,
        hospitalId: decoded.hospitalId,
        doctorId: decoded.doctorId,
      };

      next();
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError('Invalid or expired token', 'INVALID_TOKEN');
    }

  } catch (error) {
    next(error);
  }
};

/**
 * Optional Authentication Middleware
 * Populates req.user if token is present, else continues
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Extract token from Header or Cookie
    let token = extractTokenFromHeader(req.headers.authorization);

    // If no header token, check cookies
    if (!token) {
      const { accessToken } = getTokensFromReq(req);
      token = accessToken;
    }

    if (!token) {
      return next();
    }

    // 2. Verify Token
    try {
      const decoded = verifyToken(token) as TokenPayload;

      // 3. Populate req.user (matches AuthUser interface)
      (req as any).user = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        sessionId: decoded.sessionId,
        hospitalId: decoded.hospitalId,
        doctorId: decoded.doctorId,
      };
    } catch (error) {
      // Ignore invalid tokens in optional auth
    }

    next();
  } catch (error) {
    next();
  }
};
