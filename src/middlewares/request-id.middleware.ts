import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Request ID middleware
 * - Generates or accepts request ID for correlation
 * - Sets start time for performance tracking
 * - Adds response header for debugging
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const requestId = (req.headers['x-request-id'] as string) || uuidv4();

    // Set on request object for access throughout the request lifecycle
    req.requestId = requestId;
    req.startTime = Date.now();

    // Also keep in headers for backward compatibility
    req.headers['x-request-id'] = requestId;

    // Set response header for client debugging/correlation
    res.setHeader('X-Request-ID', requestId);

    next();
};

