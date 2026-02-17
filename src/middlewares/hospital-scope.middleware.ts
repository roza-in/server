import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, NotFoundError } from '../common/errors/index.js';
import { logger } from '../config/logger.js';

const log = logger.child('HospitalScope');

/**
 * Middleware to enforce hospital-level data isolation.
 * Expects hospitalId in params or x-hospital-id header.
 *
 * DB roles: patient | reception | doctor | hospital | pharmacy | admin
 * AuthUser fields: userId, role, hospitalId, doctorId (camelCase)
 */
export const hospitalScope = (paramName: string = 'hospitalId') => {
    return async (req: Request, _res: Response, next: NextFunction) => {
        const hospitalId = req.params[paramName] || req.headers['x-hospital-id'];

        if (!hospitalId) {
            return next(new NotFoundError('Hospital ID must be provided'));
        }

        const user = (req as any).user;

        // Admin bypasses hospital scope (platform-wide access)
        if (user?.role === 'admin') {
            (req as any).hospitalId = hospitalId;
            return next();
        }

        // If user is doctor/hospital/reception/pharmacy, ensure they belong to this hospital
        if (user && ['doctor', 'hospital', 'reception', 'pharmacy'].includes(user.role)) {
            if (user.hospitalId !== hospitalId) {
                log.warn(`Hospital scope violation: user ${user.userId} (${user.role}) tried to access hospital ${hospitalId}, belongs to ${user.hospitalId}`);
                return next(new ForbiddenError('You do not have access to this hospital data'));
            }
        }

        // Store hospitalId in request for later use in services
        (req as any).hospitalId = hospitalId;
        next();
    };
};

/**
 * SC5: Auto-scope middleware for routes without an explicit :hospitalId param.
 * Uses the authenticated user's own hospitalId to enforce isolation.
 * Useful for reception/doctor routes that implicitly operate on their own hospital.
 */
export const autoHospitalScope = () => {
    return (req: Request, _res: Response, next: NextFunction) => {
        const user = (req as any).user;

        // Admin doesn't need hospital scoping
        if (user?.role === 'admin') {
            return next();
        }

        if (user && ['doctor', 'hospital', 'reception', 'pharmacy'].includes(user.role)) {
            if (!user.hospitalId) {
                log.warn(`User ${user.userId} (${user.role}) has no hospitalId — denying access`);
                return next(new ForbiddenError('Your account is not associated with a hospital'));
            }
            // Attach hospitalId for services to use
            (req as any).hospitalId = user.hospitalId;
        }

        next();
    };
};
