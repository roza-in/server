import { HTTP_STATUS } from '../config/constants.js';

/**
 * Base Application Error
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);

    // Set prototype explicitly for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * 400 - Bad Request
 */
export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request', details?: Record<string, unknown>) {
    super(message, HTTP_STATUS.BAD_REQUEST, 'BAD_REQUEST', true, details);
  }
}

/**
 * 401 - Unauthorized
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, HTTP_STATUS.UNAUTHORIZED, 'UNAUTHORIZED', true);
  }
}

/**
 * 403 - Forbidden
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, HTTP_STATUS.FORBIDDEN, 'FORBIDDEN', true);
  }
}

/**
 * 404 - Not Found
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, HTTP_STATUS.NOT_FOUND, 'NOT_FOUND', true);
  }
}

/**
 * 409 - Conflict
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, HTTP_STATUS.CONFLICT, 'CONFLICT', true);
  }
}

/**
 * 422 - Validation Error
 */
export class ValidationError extends AppError {
  public readonly errors: Array<{ field: string; message: string }>;

  constructor(
    errors: Array<{ field: string; message: string }>,
    message: string = 'Validation failed'
  ) {
    super(message, HTTP_STATUS.UNPROCESSABLE_ENTITY, 'VALIDATION_ERROR', true, { errors });
    this.errors = errors;
  }
}

/**
 * 429 - Too Many Requests
 */
export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too many requests, please try again later') {
    super(message, HTTP_STATUS.TOO_MANY_REQUESTS, 'RATE_LIMIT_EXCEEDED', true);
  }
}

/**
 * 500 - Internal Server Error
 */
export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error') {
    super(message, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'INTERNAL_ERROR', false);
  }
}

/**
 * 502 - Bad Gateway
 */
export class BadGatewayError extends AppError {
  constructor(message: string = 'Bad gateway') {
    super(message, HTTP_STATUS.BAD_GATEWAY, 'BAD_GATEWAY', true);
  }
}

/**
 * 503 - Service Unavailable
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable') {
    super(message, HTTP_STATUS.SERVICE_UNAVAILABLE, 'SERVICE_UNAVAILABLE', true);
  }
}

// =============================================================================
// Domain-Specific Errors
// =============================================================================

/**
 * Authentication Errors
 */
export class InvalidCredentialsError extends AppError {
  constructor() {
    super('Invalid credentials', HTTP_STATUS.UNAUTHORIZED, 'INVALID_CREDENTIALS', true);
  }
}

export class TokenExpiredError extends AppError {
  constructor() {
    super('Token has expired', HTTP_STATUS.UNAUTHORIZED, 'TOKEN_EXPIRED', true);
  }
}

export class InvalidTokenError extends AppError {
  constructor() {
    super('Invalid token', HTTP_STATUS.UNAUTHORIZED, 'INVALID_TOKEN', true);
  }
}

export class OTPExpiredError extends AppError {
  constructor() {
    super('OTP has expired', HTTP_STATUS.BAD_REQUEST, 'OTP_EXPIRED', true);
  }
}

export class OTPInvalidError extends AppError {
  constructor(message: string = 'Invalid OTP') {
    super(message, HTTP_STATUS.BAD_REQUEST, 'OTP_INVALID', true);
  }
}

export class MaxOTPAttemptsError extends AppError {
  constructor() {
    super('Maximum OTP attempts exceeded', HTTP_STATUS.TOO_MANY_REQUESTS, 'MAX_OTP_ATTEMPTS', true);
  }
}

/**
 * Hospital Errors
 */
export class HospitalNotFoundError extends AppError {
  constructor() {
    super('Hospital not found', HTTP_STATUS.NOT_FOUND, 'HOSPITAL_NOT_FOUND', true);
  }
}

export class HospitalNotVerifiedError extends AppError {
  constructor() {
    super('Hospital is not verified', HTTP_STATUS.FORBIDDEN, 'HOSPITAL_NOT_VERIFIED', true);
  }
}

/**
 * Doctor Errors
 */
export class DoctorNotFoundError extends AppError {
  constructor() {
    super('Doctor not found', HTTP_STATUS.NOT_FOUND, 'DOCTOR_NOT_FOUND', true);
  }
}

export class DoctorNotAvailableError extends AppError {
  constructor() {
    super('Doctor is not available for consultations', HTTP_STATUS.BAD_REQUEST, 'DOCTOR_NOT_AVAILABLE', true);
  }
}

/**
 * Appointment Errors
 */
export class AppointmentNotFoundError extends AppError {
  constructor() {
    super('Appointment not found', HTTP_STATUS.NOT_FOUND, 'APPOINTMENT_NOT_FOUND', true);
  }
}

export class SlotNotAvailableError extends AppError {
  constructor() {
    super('Selected time slot is not available', HTTP_STATUS.CONFLICT, 'SLOT_NOT_AVAILABLE', true);
  }
}

export class InvalidAppointmentStatusError extends AppError {
  constructor(currentStatus: string, requiredStatus: string) {
    super(`Cannot perform this action. Appointment status is '${currentStatus}', expected '${requiredStatus}'`, HTTP_STATUS.BAD_REQUEST, 'INVALID_APPOINTMENT_STATUS', true);
  }
}

export class AppointmentAlreadyCancelledError extends AppError {
  constructor() {
    super('Appointment has already been cancelled', HTTP_STATUS.BAD_REQUEST, 'APPOINTMENT_ALREADY_CANCELLED', true);
  }
}

/**
 * Payment Errors
 */
export class PaymentNotFoundError extends AppError {
  constructor() {
    super('Payment not found', HTTP_STATUS.NOT_FOUND, 'PAYMENT_NOT_FOUND', true);
  }
}

export class PaymentFailedError extends AppError {
  constructor(reason?: string) {
    super(reason ? `Payment failed: ${reason}` : 'Payment failed', HTTP_STATUS.BAD_REQUEST, 'PAYMENT_FAILED', true);
  }
}

export class RefundNotAllowedError extends AppError {
  constructor(reason?: string) {
    super(reason ? `Refund not allowed: ${reason}` : 'Refund not allowed', HTTP_STATUS.BAD_REQUEST, 'REFUND_NOT_ALLOWED', true);
  }
}

/**
 * User Errors
 */
export class UserNotFoundError extends AppError {
  constructor(message: string = 'User not found') {
    super(message, HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND', true);
  }
}

export class UserAlreadyExistsError extends AppError {
  constructor(field: string = 'phone') {
    super(`User with this ${field} already exists`, HTTP_STATUS.CONFLICT, 'USER_ALREADY_EXISTS', true);
  }
}

export class UserSuspendedError extends AppError {
  constructor() {
    super('Your account has been suspended', HTTP_STATUS.FORBIDDEN, 'USER_SUSPENDED', true);
  }
}

/**
 * Schedule Errors
 */
export class ScheduleConflictError extends AppError {
  constructor() {
    super('Schedule conflict detected', HTTP_STATUS.CONFLICT, 'SCHEDULE_CONFLICT', true);
  }
}

/**
 * Type guard to check if error is an AppError
 */
export const isAppError = (error: unknown): error is AppError => {
  return error instanceof AppError;
};

/**
 * Type guard to check if error is operational (safe to expose to client)
 */
export const isOperationalError = (error: unknown): boolean => {
  if (isAppError(error)) {
    return error.isOperational;
  }
  return false;
};
