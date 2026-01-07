import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../common/errors.js';
import type { UserRole } from '../types/roles.js';
import { hasRolePermission, hasPermission } from '../types/roles.js';

/**
 * Role-based access control middleware
 * Checks if the authenticated user has one of the required roles
 */
export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new ForbiddenError('Authentication required');
      }

      const userRole = req.user.role;

      // Check if user's role is in the allowed roles
      if (!allowedRoles.includes(userRole)) {
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
 * Permission-based access control middleware
 * Checks if the authenticated user has the required permission
 */
export const requirePermission = (permission: string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new ForbiddenError('Authentication required');
      }

      if (!hasPermission(req.user.role, permission)) {
        throw new ForbiddenError(`Access denied. Missing permission: ${permission}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Minimum role level middleware
 * Checks if the authenticated user has at least the required role level
 */
export const requireMinRole = (minRole: UserRole) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new ForbiddenError('Authentication required');
      }

      if (!hasRolePermission(req.user.role, minRole)) {
        throw new ForbiddenError(`Access denied. Minimum required role: ${minRole}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Hospital owner middleware
 * Ensures the user is a hospital and optionally verifies hospital ID
 */
export const requireHospitalOwner = (hospitalIdParam?: string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new ForbiddenError('Authentication required');
      }

      if (req.user.role !== 'hospital') {
        throw new ForbiddenError('Only hospital accounts can access this resource');
      }

      if (!req.user.hospitalId) {
        throw new ForbiddenError('Hospital ID not found in token');
      }

      // If hospitalIdParam is provided, verify it matches the user's hospital
      if (hospitalIdParam) {
        const requestedHospitalId = req.params[hospitalIdParam];
        if (requestedHospitalId && requestedHospitalId !== req.user.hospitalId) {
          throw new ForbiddenError('You can only access your own hospital resources');
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Doctor owner middleware
 * Ensures the user is a doctor and optionally verifies doctor ID
 */
export const requireDoctorOwner = (doctorIdParam?: string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new ForbiddenError('Authentication required');
      }

      if (req.user.role !== 'doctor') {
        throw new ForbiddenError('Only doctor accounts can access this resource');
      }

      if (!req.user.doctorId) {
        throw new ForbiddenError('Doctor ID not found in token');
      }

      // If doctorIdParam is provided, verify it matches the user's doctor ID
      if (doctorIdParam) {
        const requestedDoctorId = req.params[doctorIdParam];
        if (requestedDoctorId && requestedDoctorId !== req.user.doctorId) {
          throw new ForbiddenError('You can only access your own resources');
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Patient owner middleware
 * Ensures the user is a patient or admin
 */
export const requirePatientRole = () => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new ForbiddenError('Authentication required');
      }

      if (req.user.role !== 'patient' && req.user.role !== 'admin') {
        throw new ForbiddenError('Only patient accounts can access this resource');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Admin only middleware
 */
export const requireAdmin = () => requireRole('admin');

/**
 * Hospital or Admin middleware
 */
export const requireHospitalOrAdmin = () => requireRole('hospital', 'admin');

/**
 * Doctor, Hospital or Admin middleware
 */
export const requireStaff = () => requireRole('doctor', 'hospital', 'admin');

/**
 * Resource ownership middleware factory
 * Creates middleware that checks if user owns the resource based on user ID
 */
export const requireOwnership = (userIdExtractor: (req: Request) => string | undefined) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new ForbiddenError('Authentication required');
      }

      // Admin can access everything
      if (req.user.role === 'admin') {
        return next();
      }

      const resourceUserId = userIdExtractor(req);
      if (!resourceUserId) {
        throw new ForbiddenError('Cannot determine resource ownership');
      }

      if (req.user.userId !== resourceUserId) {
        throw new ForbiddenError('You do not have permission to access this resource');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
