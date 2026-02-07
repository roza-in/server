import { Request } from 'express';
import type { UserRole } from './roles.js';

/**
 * Authenticated user payload attached to request
 */
export interface AuthUser {
  userId: string;
  role: UserRole;
  phone?: string;
  email?: string;
  hospitalId?: string;
  doctorId?: string;
  sessionId?: string;
  iat?: number;
  exp?: number;
}

/**
 * Extended Express Request with authenticated user
 */
export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

/**
 * Request with optional user (for routes that allow both authenticated and unauthenticated)
 */
export interface OptionalAuthRequest extends Request {
  user?: AuthUser;
}

/**
 * Hospital-specific request (user must be hospital role)
 */
export interface HospitalRequest extends AuthenticatedRequest {
  user: AuthUser & {
    role: 'hospital';
    hospitalId: string;
  };
}

/**
 * Doctor-specific request (user must be doctor role)
 */
export interface DoctorRequest extends AuthenticatedRequest {
  user: AuthUser & {
    role: 'doctor';
    doctorId: string;
    hospitalId: string;
  };
}

/**
 * Patient-specific request (user must be patient role)
 */
export interface PatientRequest extends AuthenticatedRequest {
  user: AuthUser & {
    role: 'patient';
  };
}

/**
 * Admin-specific request (user must be admin role)
 */
export interface AdminRequest extends AuthenticatedRequest {
  user: AuthUser & {
    role: 'admin';
  };
}

// Extend Express Request globally
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      requestId?: string;
      startTime?: number;
      idempotencyKey?: string;
      auditAction?: string;
    }
  }
}
