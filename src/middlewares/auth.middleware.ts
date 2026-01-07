import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromHeader, TokenPayload } from '../config/jwt.js';
import {
  UnauthorizedError,
  TokenExpiredError,
  InvalidTokenError,
  UserSuspendedError,
  ForbiddenError,
} from '../common/errors.js';
import { logger } from '../common/logger.js';
import { getSupabaseAdmin } from '../config/db.js';
import type { AuthUser } from '../types/request.js';
import type { UserRole } from '../types/database.types.js';

/**
 * Authentication Middleware - Production-ready with session validation
 * Features: JWT verification, session validation, device fingerprinting
 */

// ============================================================================
// Main Authentication
// ============================================================================

/**
 * Primary authentication middleware - Verifies JWT and validates session
 */
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      throw new UnauthorizedError('Authentication token is required');
    }

    // Verify token
    let decoded: TokenPayload;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Token has expired') {
          throw new TokenExpiredError();
        }
      }
      throw new InvalidTokenError();
    }

    // Validate token type
    if (decoded.type !== 'access') {
      throw new InvalidTokenError();
    }

    // Validate session in database
    const supabase = getSupabaseAdmin();

    if (decoded.sessionId) {
      const { data: session, error: sessionError } = await supabase
        .from('user_sessions')
        .select('id, is_active, expires_at, revoked_at')
        .eq('id', decoded.sessionId)
        .single();

      if (sessionError || !session) {
        logger.warn('Session not found', { sessionId: decoded.sessionId });
        throw new UnauthorizedError('Session not found');
      }

      if (!session.is_active || session.revoked_at) {
        throw new UnauthorizedError('Session has been revoked');
      }

      if (new Date(session.expires_at) < new Date()) {
        throw new TokenExpiredError();
      }

      // Update last activity
      await supabase
        .from('user_sessions')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', decoded.sessionId);
    }

    // Get user and verify status
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, role, is_active, is_blocked, phone, email, full_name')
      .eq('id', decoded.userId)
      .single();

    if (userError || !user) {
      logger.warn(`User not found: ${decoded.userId}`);
      throw new UnauthorizedError('User not found');
    }

    if (user.is_blocked) {
      throw new UserSuspendedError();
    }

    if (!user.is_active) {
      throw new UnauthorizedError('Account is inactive');
    }

    // Attach user to request
    req.user = {
      userId: user.id,
      role: user.role as AuthUser['role'],
      phone: user.phone,
      email: user.email ?? undefined,
      fullName: user.full_name ?? undefined,
      hospitalId: decoded.hospitalId,
      doctorId: decoded.doctorId,
      sessionId: decoded.sessionId,
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional authentication - Attaches user if token present, continues otherwise
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      return next();
    }

    try {
      const decoded = verifyToken(token);

      if (decoded.type !== 'access') {
        return next();
      }

      const supabase = getSupabaseAdmin();
      const { data: user } = await supabase
        .from('users')
        .select('id, role, is_active, is_blocked, phone, email, full_name')
        .eq('id', decoded.userId)
        .single();

      if (user && user.is_active && !user.is_blocked) {
        req.user = {
          userId: user.id,
          role: user.role as AuthUser['role'],
          phone: user.phone,
          email: user.email ?? undefined,
          fullName: user.full_name ?? undefined,
          hospitalId: decoded.hospitalId,
          doctorId: decoded.doctorId,
          sessionId: decoded.sessionId,
        };
      }
    } catch {
      // Invalid token - continue without user
    }

    next();
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Role-Based Access Control
// ============================================================================

/**
 * Require specific roles
 */
export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new ForbiddenError('Authentication required');
      }

      if (!allowedRoles.includes(req.user.role as UserRole)) {
        throw new ForbiddenError(
          `Access denied. Required role: ${allowedRoles.join(' or ')}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Admin only access
 */
export const adminOnly = requireRole('admin');

/**
 * Hospital admin access
 */
export const hospitalOnly = requireRole('hospital', 'admin');

/**
 * Doctor access
 */
export const doctorOnly = requireRole('doctor', 'admin');

/**
 * Patient access
 */
export const patientOnly = requireRole('patient', 'admin');

// ============================================================================
// Resource Ownership
// ============================================================================

/**
 * Verify hospital ownership
 */
export const requireHospitalOwner = (hospitalIdParam = 'hospitalId') => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ForbiddenError('Authentication required');
      }

      // Admin can access any hospital
      if (req.user.role === 'admin') {
        return next();
      }

      if (req.user.role !== 'hospital') {
        throw new ForbiddenError('Only hospital accounts can access this resource');
      }

      const requestedHospitalId = req.params[hospitalIdParam] || req.body?.hospital_id;

      if (requestedHospitalId && requestedHospitalId !== req.user.hospitalId) {
        throw new ForbiddenError('You can only access your own hospital resources');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Verify doctor ownership
 */
export const requireDoctorOwner = (doctorIdParam = 'doctorId') => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ForbiddenError('Authentication required');
      }

      // Admin can access any doctor
      if (req.user.role === 'admin') {
        return next();
      }

      if (req.user.role !== 'doctor') {
        throw new ForbiddenError('Only doctor accounts can access this resource');
      }

      const requestedDoctorId = req.params[doctorIdParam] || req.body?.doctor_id;

      if (requestedDoctorId && requestedDoctorId !== req.user.doctorId) {
        throw new ForbiddenError('You can only access your own resources');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Verify resource ownership (patient data)
 */
export const requireOwnerOrAdmin = (userIdParam = 'userId') => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new ForbiddenError('Authentication required');
      }

      // Admin can access any resource
      if (req.user.role === 'admin') {
        return next();
      }

      const requestedUserId = req.params[userIdParam] || req.body?.user_id;

      if (requestedUserId && requestedUserId !== req.user.userId) {
        throw new ForbiddenError('You can only access your own resources');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// ============================================================================
// Refresh Token
// ============================================================================

/**
 * Verify refresh token for token renewal
 */
export const verifyRefreshToken = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refresh_token } = req.body as { refresh_token?: string };

    if (!refresh_token) {
      throw new UnauthorizedError('Refresh token is required');
    }

    let decoded: TokenPayload;
    try {
      decoded = verifyToken(refresh_token);
    } catch (error) {
      if (error instanceof Error && error.message === 'Token has expired') {
        throw new TokenExpiredError();
      }
      throw new InvalidTokenError();
    }

    if (decoded.type !== 'refresh') {
      throw new InvalidTokenError();
    }

    // Validate session
    const supabase = getSupabaseAdmin();

    if (decoded.sessionId) {
      const { data: session } = await supabase
        .from('user_sessions')
        .select('id, is_active, refresh_token_hash, revoked_at')
        .eq('id', decoded.sessionId)
        .single();

      if (!session || !session.is_active || session.revoked_at) {
        throw new UnauthorizedError('Session has been revoked');
      }
    }

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, role, is_active, is_blocked, phone, email')
      .eq('id', decoded.userId)
      .single();

    if (userError || !user) {
      throw new UnauthorizedError('User not found');
    }

    if (!user.is_active || user.is_blocked) {
      throw new UnauthorizedError('Account is not active');
    }

    req.user = {
      userId: user.id,
      role: user.role as AuthUser['role'],
      phone: user.phone,
      email: user.email ?? undefined,
      hospitalId: decoded.hospitalId,
      doctorId: decoded.doctorId,
      sessionId: decoded.sessionId,
    };

    next();
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Verification Status
// ============================================================================

/**
 * Require verified hospital
 */
export const requireVerifiedHospital = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.hospitalId) {
      throw new ForbiddenError('Hospital authentication required');
    }

    const supabase = getSupabaseAdmin();
    const { data: hospital } = await supabase
      .from('hospitals')
      .select('verification_status')
      .eq('id', req.user.hospitalId)
      .single();

    if (!hospital || hospital.verification_status !== 'verified') {
      throw new ForbiddenError('Hospital must be verified to access this resource');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Require verified doctor
 */
export const requireVerifiedDoctor = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.doctorId) {
      throw new ForbiddenError('Doctor authentication required');
    }

    const supabase = getSupabaseAdmin();
    const { data: doctor } = await supabase
      .from('doctors')
      .select('verification_status')
      .eq('id', req.user.doctorId)
      .single();

    if (!doctor || doctor.verification_status !== 'verified') {
      throw new ForbiddenError('Doctor must be verified to access this resource');
    }

    next();
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract device info from request
 */
export const extractDeviceInfo = (req: Request) => {
  return {
    user_agent: req.headers['user-agent'] || null,
    ip_address: req.ip || req.socket.remoteAddress || null,
    device_fingerprint: req.headers['x-device-fingerprint'] as string | undefined,
    platform: req.headers['x-platform'] as string | undefined,
    app_version: req.headers['x-app-version'] as string | undefined,
  };
};

/**
 * Get client IP address
 */
export const getClientIP = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return ips.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
};
