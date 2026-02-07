import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../common/errors/ApiError.js';
import { sendError } from '../common/responses/error.response.js';
import { logger } from '../config/logger.js';
import { isProduction } from '../config/env.js';

export const errorMiddleware = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errorCode = err.code || 'INTERNAL_ERROR';

  // For non-ApiError exceptions, sanitize the message in production
  if (!(err instanceof ApiError)) {
    if (isProduction) {
      // Don't leak internal error details to clients
      message = 'An unexpected error occurred';
    }
    errorCode = 'INTERNAL_ERROR';
  }

  // Always log the full error server-side
  const requestId = (req as any).requestId || 'unknown';
  logger.error(`[${requestId}] ${statusCode} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`, {
    stack: err.stack,
    user: (req as any).user?.id,
    errorCode,
  });

  // SECURITY: Never expose stack traces to clients in production
  const details = isProduction ? undefined : err.stack;

  sendError(res, message, statusCode, errorCode, details);
};

/**
 * Async handler wrapper to catch errors and pass them to the error middleware
 */
export const asyncHandler = (fn: any) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
