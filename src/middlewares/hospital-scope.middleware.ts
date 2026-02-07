import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, NotFoundError } from '../common/errors/index.js';

/**
 * Middleware to enforce hospital-level data isolation
 * Expects hospital_id in params or headers
 */
export const hospitalScope = (paramName: string = 'hospitalId') => {
    return async (req: Request, _res: Response, next: NextFunction) => {
        const hospitalId = req.params[paramName] || req.headers['x-hospital-id'];

        if (!hospitalId) {
            return next(new NotFoundError('Hospital ID must be provided'));
        }

        // If user is doctor/hospital_admin, ensure they belong to this hospital
        const user = (req as any).user;
        if (user && (user.role === 'doctor' || user.role === 'hospital_admin')) {
            if (user.hospital_id !== hospitalId) {
                return next(new ForbiddenError('You do not have access to this hospital data'));
            }
        }

        // Store hospitalId in request for later use in services
        (req as any).hospitalId = hospitalId;
        next();
    };
};
