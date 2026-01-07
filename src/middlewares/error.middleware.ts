import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, isAppError, isOperationalError, ValidationError } from '../common/errors.js';
import { sendError } from '../common/response.js';
import { logger } from '../common/logger.js';
import { HTTP_STATUS, MESSAGES } from '../config/constants.js';
import { env, isDevelopment } from '../config/env.js';

/**
 * Format Zod errors into a user-friendly format (Zod 4 compatible)
 */
const formatZodError = (error: ZodError): Array<{ field: string; message: string }> => {
  // Zod 4 uses .issues, Zod 3 uses .errors
  const issues = (error as any).issues || (error as any).errors || [];
  return issues.map((err: any) => ({
    field: err.path?.join('.') || '',
    message: err.message,
  }));
};

/**
 * Global error handler middleware
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): Response => {
  // Log the error
  const logContext = {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    userId: req.user?.userId,
  };

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const validationErrors = formatZodError(err);
    logger.warn('Validation error', { ...logContext, errors: validationErrors });
    
    return sendError(
      res,
      MESSAGES.VALIDATION_ERROR,
      HTTP_STATUS.UNPROCESSABLE_ENTITY,
      'VALIDATION_ERROR',
      { errors: validationErrors }
    );
  }

  // Handle ValidationError (our custom validation error)
  if (err instanceof ValidationError) {
    logger.warn('Validation error', { ...logContext, errors: err.errors });
    
    return sendError(
      res,
      err.message,
      err.statusCode,
      err.code,
      { errors: err.errors }
    );
  }

  // Handle our custom AppError
  if (isAppError(err)) {
    // Log operational errors as warnings, programming errors as errors
    if (err.isOperational) {
      logger.warn(`${err.code}: ${err.message}`, logContext);
    } else {
      logger.error(`${err.code}: ${err.message}`, { ...logContext, stack: err.stack });
    }

    return sendError(
      res,
      err.message,
      err.statusCode,
      err.code,
      isDevelopment ? err.details : undefined
    );
  }

  // Handle unexpected errors
  logger.error('Unexpected error', {
    ...logContext,
    error: err.message,
    stack: err.stack,
  });

  // In development, send the actual error message
  if (isDevelopment) {
    return sendError(
      res,
      err.message,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      'INTERNAL_ERROR',
      { stack: err.stack }
    );
  }

  // In production, send a generic message
  return sendError(
    res,
    MESSAGES.INTERNAL_ERROR,
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    'INTERNAL_ERROR'
  );
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  _next: NextFunction
): Response => {
  logger.warn(`Route not found: ${req.method} ${req.path}`);
  
  return sendError(
    res,
    `Route ${req.method} ${req.path} not found`,
    HTTP_STATUS.NOT_FOUND,
    'ROUTE_NOT_FOUND'
  );
};

/**
 * Async wrapper to catch errors in async route handlers
 */
export const asyncHandler = <T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Request timeout handler
 */
export const timeoutHandler = (timeout: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Set timeout for the request
    res.setTimeout(timeout, () => {
      logger.error(`Request timeout: ${req.method} ${req.path}`);
      
      if (!res.headersSent) {
        sendError(
          res,
          'Request timeout',
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'REQUEST_TIMEOUT'
        );
      }
    });

    next();
  };
};

/**
 * Uncaught exception handler - Should be registered at application startup
 */
export const setupUncaughtExceptionHandler = (): void => {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
    
    // Give time for logging, then exit
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });
};

/**
 * Unhandled promise rejection handler - Should be registered at application startup
 */
export const setupUnhandledRejectionHandler = (): void => {
  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled Rejection:', { reason });
    
    // In production, we might want to exit
    if (!isDevelopment) {
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    }
  });
};

/**
 * SIGTERM handler for graceful shutdown
 */
export const setupGracefulShutdown = (cleanup?: () => Promise<void>): void => {
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

  signals.forEach((signal) => {
    process.on(signal, async () => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);

      try {
        // Run cleanup if provided
        if (cleanup) {
          await cleanup();
        }

        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    });
  });
};
