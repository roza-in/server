import { ApiError } from './ApiError.js';
import { HTTP_STATUS } from '../../config/constants.js';

export class AuthError extends ApiError {
    constructor(message: string = 'Authentication required', code: string = 'UNAUTHORIZED') {
        super(message, HTTP_STATUS.UNAUTHORIZED, code, true);
    }
}

export class InvalidCredentialsError extends AuthError {
    constructor() {
        super('Invalid credentials', 'INVALID_CREDENTIALS');
    }
}

export class TokenExpiredError extends AuthError {
    constructor() {
        super('Token has expired', 'TOKEN_EXPIRED');
    }
}

export class InvalidTokenError extends AuthError {
    constructor() {
        super('Invalid token', 'INVALID_TOKEN');
    }
}

export class OTPExpiredError extends ApiError {
    constructor() {
        super('OTP has expired', HTTP_STATUS.BAD_REQUEST, 'OTP_EXPIRED', true);
    }
}

export class OTPInvalidError extends ApiError {
    constructor(message: string = 'Invalid OTP') {
        super(message, HTTP_STATUS.BAD_REQUEST, 'OTP_INVALID', true);
    }
}

export class UnauthorizedError extends AuthError {
    constructor(message: string = 'Unauthorized access') {
        super(message, 'UNAUTHORIZED');
    }
}
