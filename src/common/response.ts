import { Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '../config/constants.js';

/**
 * Standard API Response Structure
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: {
    code: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
  timestamp: string;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Calculate pagination metadata
 */
export const calculatePagination = (
  total: number,
  page: number,
  limit: number
): PaginationMeta => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

/**
 * Send success response
 */
export const sendSuccess = <T>(
  res: Response,
  data?: T,
  message: string = MESSAGES.SUCCESS,
  statusCode: number = HTTP_STATUS.OK,
  meta?: PaginationMeta
): Response<ApiResponse<T>> => {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  };

  if (meta) {
    response.meta = meta;
  }

  return res.status(statusCode).json(response);
};

/**
 * Send created response (201)
 */
export const sendCreated = <T>(
  res: Response,
  data?: T,
  message: string = MESSAGES.CREATED
): Response<ApiResponse<T>> => {
  return sendSuccess(res, data, message, HTTP_STATUS.CREATED);
};

/**
 * Send no content response (204)
 */
export const sendNoContent = (res: Response): Response => {
  return res.status(HTTP_STATUS.NO_CONTENT).send();
};

/**
 * Send error response
 */
export const sendError = (
  res: Response,
  message: string,
  statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
  code: string = 'INTERNAL_ERROR',
  details?: unknown
): Response<ApiResponse<never>> => {
  const response: ApiResponse<never> = {
    success: false,
    message,
    error: {
      code,
      details,
    },
    timestamp: new Date().toISOString(),
  };

  return res.status(statusCode).json(response);
};

/**
 * Send paginated response
 */
export const sendPaginated = <T>(
  res: Response,
  data: T[],
  pagination: PaginationMeta,
  message: string = MESSAGES.SUCCESS
): Response<ApiResponse<T[]>> => {
  return sendSuccess(res, data, message, HTTP_STATUS.OK, pagination);
};

// =============================================================================
// Pre-built Response Helpers
// =============================================================================

export const responses = {
  // Success responses
  ok: <T>(res: Response, data?: T, message?: string) =>
    sendSuccess(res, data, message ?? MESSAGES.SUCCESS),

  created: <T>(res: Response, data?: T, message?: string) =>
    sendCreated(res, data, message ?? MESSAGES.CREATED),

  updated: <T>(res: Response, data?: T) =>
    sendSuccess(res, data, MESSAGES.UPDATED),

  deleted: (res: Response) =>
    sendSuccess(res, undefined, MESSAGES.DELETED),

  noContent: (res: Response) =>
    sendNoContent(res),

  // Error responses
  badRequest: (res: Response, message?: string, details?: unknown) =>
    sendError(res, message ?? MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST, 'BAD_REQUEST', details),

  unauthorized: (res: Response, message?: string) =>
    sendError(res, message ?? MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED, 'UNAUTHORIZED'),

  forbidden: (res: Response, message?: string) =>
    sendError(res, message ?? MESSAGES.FORBIDDEN, HTTP_STATUS.FORBIDDEN, 'FORBIDDEN'),

  notFound: (res: Response, resource?: string) =>
    sendError(res, resource ? `${resource} not found` : MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND, 'NOT_FOUND'),

  conflict: (res: Response, message?: string) =>
    sendError(res, message ?? 'Resource already exists', HTTP_STATUS.CONFLICT, 'CONFLICT'),

  validationError: (res: Response, errors: Array<{ field: string; message: string }>) =>
    sendError(res, MESSAGES.VALIDATION_ERROR, HTTP_STATUS.UNPROCESSABLE_ENTITY, 'VALIDATION_ERROR', { errors }),

  tooManyRequests: (res: Response, message?: string) =>
    sendError(res, message ?? MESSAGES.RATE_LIMIT_EXCEEDED, HTTP_STATUS.TOO_MANY_REQUESTS, 'RATE_LIMIT_EXCEEDED'),

  internalError: (res: Response, message?: string) =>
    sendError(res, message ?? MESSAGES.INTERNAL_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'INTERNAL_ERROR'),

  serviceUnavailable: (res: Response, message?: string) =>
    sendError(res, message ?? 'Service temporarily unavailable', HTTP_STATUS.SERVICE_UNAVAILABLE, 'SERVICE_UNAVAILABLE'),
};

// =============================================================================
// Type-safe response wrapper for async controllers
// =============================================================================

export type AsyncHandler<T = unknown> = (
  ...args: Parameters<(req: Request, res: Response) => Promise<T>>
) => Promise<Response<ApiResponse<T>>>;
