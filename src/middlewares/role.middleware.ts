import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../common/errors/ApiError.js';
import type { UserRole } from '../types/database.types.js';

/**
 * Role-based access control middleware
 * 
 * Usage:
 *   // Check if user has one of the allowed roles
 *   roleGuard('admin', 'hospital')
 * 
 *   // Check if user owns the resource (param matches user's ID or related ID)
 *   roleGuard({ ownerParam: 'userId' })  // req.user.id === req.params.userId
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

export const roleGuard = (...allowedRolesOrOwners: RoleOrOwner[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user) {
      throw new ForbiddenError('Authentication required');
    }

    const userRole = user.role as string;
    const userId = user.id as string;
    const userHospitalId = user.hospitalId as string | undefined;
    const userDoctorId = user.doctorId as string | undefined;

    // Check each allowed role or ownership condition
    for (const allowed of allowedRolesOrOwners) {
      // Check ownership condition
      if (isOwnerConfig(allowed)) {
        const paramValue = req.params[allowed.ownerParam];

        if (!paramValue) {
          continue; // Skip if param doesn't exist
        }

        // Check various ownership matches
        // 1. Direct user ID match
        if (allowed.ownerParam === 'userId' && paramValue === userId) {
          return next();
        }

        // 2. Hospital ID match (for hospital admins)
        if (allowed.ownerParam === 'hospitalId' && paramValue === userHospitalId) {
          return next();
        }

        // 3. Doctor ID match (for doctors)
        if (allowed.ownerParam === 'doctorId' && paramValue === userDoctorId) {
          return next();
        }

        // 4. Generic check - param matches user's property of same name
        const userPropValue = user[allowed.ownerParam];
        if (userPropValue && paramValue === userPropValue) {
          return next();
        }
      } else {
        // Check role match
        if (userRole === allowed) {
          return next();
        }
      }
    }

    // Handle admin bypass - admins can access everything
    if (userRole === 'admin') {
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
