import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../common/errors/ApiError.js';
import { logger } from '../config/logger.js';
import type { UserRole } from '../types/database.types.js';

const log = logger.child('RoleGuard');

/**
 * Role-based access control middleware
 * 
 * Usage:
 *   // Check if user has one of the allowed roles
 *   roleGuard('admin', 'hospital')
 * 
 *   // Check if user owns the resource (param matches user's ID or related ID)
 *   roleGuard({ ownerParam: 'userId' })  // req.user.userId === req.params.userId
 *   roleGuard({ ownerParam: 'hospitalId' })  // req.user.hospitalId === req.params.hospitalId
 *   roleGuard({ ownerParam: 'doctorId' })  // req.user.doctorId === req.params.doctorId
 * 
 *   // Allow either role OR ownership
 *   roleGuard('admin', { ownerParam: 'userId' })
 */

type RoleOrOwner = UserRole | string | { ownerParam: string };

interface OwnerConfig {
  ownerParam: string;
}

function isOwnerConfig(arg: RoleOrOwner): arg is OwnerConfig {
  return typeof arg === 'object' && 'ownerParam' in arg;
}

/**
 * Core role/ownership checking logic shared by roleGuard and strictRoleGuard.
 * Returns `true` if any of the allowedRolesOrOwners matches the user.
 */
function checkRolesOrOwnership(req: Request, allowedRolesOrOwners: RoleOrOwner[]): boolean {
  const user = (req as any).user;
  if (!user) return false;

  const userRole = user.role as string;
  const userId = user.userId as string;
  const userHospitalId = user.hospitalId as string | undefined;
  const userDoctorId = user.doctorId as string | undefined;

  for (const allowed of allowedRolesOrOwners) {
    if (isOwnerConfig(allowed)) {
      const paramValue = req.params[allowed.ownerParam];
      if (!paramValue) continue;

      if (allowed.ownerParam === 'userId' && paramValue === userId) return true;
      if (allowed.ownerParam === 'hospitalId' && paramValue === userHospitalId) return true;
      if (allowed.ownerParam === 'doctorId' && paramValue === userDoctorId) return true;

      const userPropValue = user[allowed.ownerParam];
      if (userPropValue && paramValue === userPropValue) return true;
    } else {
      if (userRole === allowed) return true;
    }
  }

  return false;
}

/**
 * Standard role guard — if none of the explicit roles/ownership conditions
 * match, admins are granted access as a fallback.  Admin access is logged
 * so it can be audited.
 *
 * Use `strictRoleGuard` for PHI-sensitive endpoints where even admins
 * should NOT have blanket access.
 */
export const roleGuard = (...allowedRolesOrOwners: RoleOrOwner[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user) {
      throw new ForbiddenError('Authentication required');
    }

    // Check explicit roles / ownership first
    if (checkRolesOrOwnership(req, allowedRolesOrOwners)) {
      return next();
    }

    // S6: Admin fallback — still allowed for non-PHI routes, but now audited
    if (user.role === 'admin') {
      log.info('Admin fallback access', {
        userId: user.userId,
        method: req.method,
        path: req.originalUrl,
      });
      return next();
    }

    throw new ForbiddenError('You do not have permission to perform this action');
  };
};

/**
 * Strict role guard — NO automatic admin bypass.
 *
 * Use this for endpoints that handle Protected Health Information (PHI),
 * patient medical records, prescriptions, lab results, etc.
 * If admin access is needed, explicitly include 'admin' in the allowed roles.
 *
 * @example
 *   // Only the owning patient or their doctor can view health records
 *   strictRoleGuard('doctor', { ownerParam: 'userId' })
 *
 *   // Admin CAN access, but only when explicitly listed
 *   strictRoleGuard('admin', 'doctor', { ownerParam: 'userId' })
 */
export const strictRoleGuard = (...allowedRolesOrOwners: RoleOrOwner[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user) {
      throw new ForbiddenError('Authentication required');
    }

    if (checkRolesOrOwnership(req, allowedRolesOrOwners)) {
      // Log admin access on strict routes for audit trail
      if (user.role === 'admin') {
        log.warn('Admin accessing PHI-restricted endpoint', {
          userId: user.userId,
          method: req.method,
          path: req.originalUrl,
        });
      }
      return next();
    }

    throw new ForbiddenError('You do not have permission to perform this action');
  };
};

/**
 * Convenience guards for common patterns
 */

// Require admin role
export const adminOnly = roleGuard('admin');

// Require ownership OR admin
export const ownerOrAdmin = (ownerParam: string) => roleGuard('admin', { ownerParam });

// Hospital staff (hospital admin or associated doctor)
export const hospitalStaff = roleGuard('admin', 'hospital', 'doctor');
