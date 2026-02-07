import { HTTP_STATUS } from '../../config/constants.js';

/**
 * Base Application Error
 */
export class ApiError extends Error {
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

        Error.captureStackTrace(this, this.constructor);
        Object.setPrototypeOf(this, ApiError.prototype);
    }
}

export class BadRequestError extends ApiError {
    constructor(message: string = 'Bad request', details?: Record<string, unknown>) {
        super(message, HTTP_STATUS.BAD_REQUEST, 'BAD_REQUEST', true, details);
    }
}

export class ForbiddenError extends ApiError {
    constructor(message: string = 'Access denied') {
        super(message, HTTP_STATUS.FORBIDDEN, 'FORBIDDEN', true);
    }
}

export class NotFoundError extends ApiError {
    constructor(resource: string = 'Resource') {
        super(`${resource} not found`, HTTP_STATUS.NOT_FOUND, 'NOT_FOUND', true);
    }
}

export class ConflictError extends ApiError {
    constructor(message: string = 'Resource already exists') {
        super(message, HTTP_STATUS.CONFLICT, 'CONFLICT', true);
    }
}

export class InternalServerError extends ApiError {
    constructor(message: string = 'Internal server error') {
        super(message, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'INTERNAL_ERROR', false);
    }
}

// =============================================================================
// Domain-Specific Errors
// =============================================================================

export class HospitalNotFoundError extends NotFoundError {
    constructor() {
        super('Hospital');
    }
}

export class DoctorNotFoundError extends NotFoundError {
    constructor() {
        super('Doctor');
    }
}

export class AppointmentNotFoundError extends NotFoundError {
    constructor() {
        super('Appointment');
    }
}

export class UserNotFoundError extends NotFoundError {
    constructor(message: string = 'User not found') {
        super(message);
    }
}

export class UserAlreadyExistsError extends ConflictError {
    constructor(field: string = 'phone') {
        super(`User with this ${field} already exists`);
    }
}

export class SlotNotAvailableError extends ConflictError {
    constructor() {
        super('Selected time slot is not available');
    }
}

export class ScheduleConflictError extends ConflictError {
    constructor() {
        super('Schedule conflict detected');
    }
}
