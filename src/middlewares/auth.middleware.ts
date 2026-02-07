import { Request, Response, NextFunction } from 'express';
import { AuthError } from '../common/errors/index.js';
import { verifyToken, extractTokenFromHeader } from '../common/utils/jwt.js';
import { getTokensFromReq } from '../common/utils/cookies.js';
import { TokenPayload } from '../types/jwt.js';

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

      // 3. Populate req.user
      (req as any).user = {
        id: decoded.userId, // For backward compatibility
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        sessionId: decoded.sessionId, // Critical for logout
        hospitalId: decoded.hospitalId,
        doctorId: decoded.doctorId,
      };

      next();
    } catch (error) {
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

      // 3. Populate req.user
      (req as any).user = {
        id: decoded.userId,
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
