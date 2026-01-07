import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
import { env } from './env.js';
import type { UserRole } from '../types/roles.js';

// JWT Payload interface
export interface TokenPayload extends JwtPayload {
  userId: string;
  role: UserRole;
  phone?: string;
  email?: string;
  hospitalId?: string;
  doctorId?: string;
  sessionId?: string;
}

// Token types
export type TokenType = 'access' | 'refresh';

// JWT Configuration
export const jwtConfig = {
  secret: env.JWT_SECRET,
  accessTokenExpiry: env.JWT_ACCESS_TOKEN_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  refreshTokenExpiry: env.JWT_REFRESH_TOKEN_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  issuer: env.JWT_ISSUER,
  algorithm: 'HS256' as const,
};

/**
 * Generate access token
 */
export const generateAccessToken = (payload: Omit<TokenPayload, 'iat' | 'exp' | 'iss'>): string => {
  const options: SignOptions = {
    expiresIn: jwtConfig.accessTokenExpiry,
    issuer: jwtConfig.issuer,
    algorithm: jwtConfig.algorithm,
  };

  return jwt.sign(
    { ...payload, type: 'access' },
    jwtConfig.secret,
    options
  );
};

/**
 * Generate refresh token
 */
export const generateRefreshToken = (payload: Omit<TokenPayload, 'iat' | 'exp' | 'iss'>): string => {
  const options: SignOptions = {
    expiresIn: jwtConfig.refreshTokenExpiry,
    issuer: jwtConfig.issuer,
    algorithm: jwtConfig.algorithm,
  };

  return jwt.sign(
    { ...payload, type: 'refresh' },
    jwtConfig.secret,
    options
  );
};

/**
 * Generate both access and refresh tokens
 */
export const generateTokenPair = (
  payload: Omit<TokenPayload, 'iat' | 'exp' | 'iss'>
): { accessToken: string; refreshToken: string } => {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
};

/**
 * Verify and decode token
 */
export const verifyToken = (token: string): TokenPayload => {
  try {
    const decoded = jwt.verify(token, jwtConfig.secret, {
      issuer: jwtConfig.issuer,
      algorithms: [jwtConfig.algorithm],
    }) as TokenPayload;

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error;
  }
};

/**
 * Verify refresh token specifically
 */
export const verifyRefreshToken = (token: string): TokenPayload | null => {
  try {
    const decoded = jwt.verify(token, jwtConfig.secret, {
      issuer: jwtConfig.issuer,
      algorithms: [jwtConfig.algorithm],
    }) as TokenPayload;

    // Ensure it's a refresh token
    if ((decoded as any).type !== 'refresh') {
      return null;
    }

    return decoded;
  } catch (error) {
    return null;
  }
};

/**
 * Decode token without verification (for debugging/inspection)
 */
export const decodeToken = (token: string): TokenPayload | null => {
  try {
    return jwt.decode(token) as TokenPayload | null;
  } catch {
    return null;
  }
};

/**
 * Check if token is expired
 */
export const isTokenExpired = (token: string): boolean => {
  try {
    const decoded = jwt.decode(token) as TokenPayload | null;
    if (!decoded?.exp) return true;
    return Date.now() >= decoded.exp * 1000;
  } catch {
    return true;
  }
};

/**
 * Get token expiry date
 */
export const getTokenExpiry = (token: string): Date | null => {
  try {
    const decoded = jwt.decode(token) as TokenPayload | null;
    if (!decoded?.exp) return null;
    return new Date(decoded.exp * 1000);
  } catch {
    return null;
  }
};

/**
 * Extract token from Authorization header
 */
export const extractTokenFromHeader = (authHeader: string | undefined): string | null => {
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  
  return parts[1] ?? null;
};
