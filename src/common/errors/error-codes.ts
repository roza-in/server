/**
 * ROZX Healthcare Platform - Centralized Error Codes
 * 
 * Error code format: {DOMAIN}_{ACTION}_{REASON}
 * Examples: AUTH_LOGIN_INVALID_CREDENTIALS, PAYMENT_REFUND_NOT_ALLOWED
 * 
 * @module ErrorCodes
 */

/**
 * Error Code Categories
 */
export enum ErrorCategory {
    /** General/System errors */
    GENERAL = 'GENERAL',
    /** Authentication & Authorization */
    AUTH = 'AUTH',
    /** Validation errors */
    VALIDATION = 'VALIDATION',
    /** User management */
    USER = 'USER',
    /** Hospital operations */
    HOSPITAL = 'HOSPITAL',
    /** Doctor operations */
    DOCTOR = 'DOCTOR',
    /** Appointment operations */
    APPOINTMENT = 'APPOINTMENT',
    /** Payment & transactions */
    PAYMENT = 'PAYMENT',
    /** Prescription operations */
    PRESCRIPTION = 'PRESCRIPTION',
    /** Health records */
    RECORD = 'RECORD',
    /** Notification system */
    NOTIFICATION = 'NOTIFICATION',
    /** External service integrations */
    INTEGRATION = 'INTEGRATION',
}

/**
 * Centralized Error Codes Registry
 * 
 * Each error code maps to:
 * - code: Unique error identifier
 * - httpStatus: HTTP status code
 * - message: Default user-facing message
 * - description: Developer documentation
 */
export const ERROR_CODES = {
    // ============================================================
    // GENERAL ERRORS (1000-1999)
    // ============================================================
    INTERNAL_ERROR: {
        code: 'INTERNAL_ERROR',
        httpStatus: 500,
        message: 'An unexpected error occurred',
        description: 'Unhandled server error. Check logs for details.',
    },
    NOT_FOUND: {
        code: 'NOT_FOUND',
        httpStatus: 404,
        message: 'Resource not found',
        description: 'The requested resource does not exist.',
    },
    BAD_REQUEST: {
        code: 'BAD_REQUEST',
        httpStatus: 400,
        message: 'Invalid request',
        description: 'The request was malformed or missing required fields.',
    },
    FORBIDDEN: {
        code: 'FORBIDDEN',
        httpStatus: 403,
        message: 'Access denied',
        description: 'User does not have permission to access this resource.',
    },
    CONFLICT: {
        code: 'CONFLICT',
        httpStatus: 409,
        message: 'Resource conflict',
        description: 'The operation conflicts with existing data.',
    },
    RATE_LIMITED: {
        code: 'RATE_LIMITED',
        httpStatus: 429,
        message: 'Too many requests',
        description: 'Rate limit exceeded. Try again later.',
    },
    SERVICE_UNAVAILABLE: {
        code: 'SERVICE_UNAVAILABLE',
        httpStatus: 503,
        message: 'Service temporarily unavailable',
        description: 'External service or dependency is unavailable.',
    },

    // ============================================================
    // AUTHENTICATION ERRORS (2000-2999)
    // ============================================================
    AUTH_REQUIRED: {
        code: 'AUTH_REQUIRED',
        httpStatus: 401,
        message: 'Authentication required',
        description: 'Request requires valid authentication credentials.',
    },
    AUTH_INVALID_CREDENTIALS: {
        code: 'AUTH_INVALID_CREDENTIALS',
        httpStatus: 401,
        message: 'Invalid credentials',
        description: 'Email/phone and password combination is incorrect.',
    },
    AUTH_TOKEN_EXPIRED: {
        code: 'AUTH_TOKEN_EXPIRED',
        httpStatus: 401,
        message: 'Session expired',
        description: 'Authentication token has expired. Please login again.',
    },
    AUTH_TOKEN_INVALID: {
        code: 'AUTH_TOKEN_INVALID',
        httpStatus: 401,
        message: 'Invalid token',
        description: 'Authentication token is malformed or invalid.',
    },
    AUTH_OTP_EXPIRED: {
        code: 'AUTH_OTP_EXPIRED',
        httpStatus: 400,
        message: 'OTP has expired',
        description: 'One-time password has expired. Request a new one.',
    },
    AUTH_OTP_INVALID: {
        code: 'AUTH_OTP_INVALID',
        httpStatus: 400,
        message: 'Invalid OTP',
        description: 'One-time password is incorrect.',
    },
    AUTH_OTP_MAX_ATTEMPTS: {
        code: 'AUTH_OTP_MAX_ATTEMPTS',
        httpStatus: 400,
        message: 'Maximum OTP attempts exceeded',
        description: 'Too many failed OTP attempts. Request a new one.',
    },
    AUTH_ACCOUNT_LOCKED: {
        code: 'AUTH_ACCOUNT_LOCKED',
        httpStatus: 403,
        message: 'Account temporarily locked',
        description: 'Account locked due to multiple failed login attempts.',
    },
    AUTH_ACCOUNT_BLOCKED: {
        code: 'AUTH_ACCOUNT_BLOCKED',
        httpStatus: 403,
        message: 'Account blocked',
        description: 'Account has been blocked. Contact support.',
    },
    AUTH_SESSION_REVOKED: {
        code: 'AUTH_SESSION_REVOKED',
        httpStatus: 401,
        message: 'Session revoked',
        description: 'Session was revoked. Please login again.',
    },

    // ============================================================
    // VALIDATION ERRORS (3000-3999)
    // ============================================================
    VALIDATION_FAILED: {
        code: 'VALIDATION_FAILED',
        httpStatus: 400,
        message: 'Validation failed',
        description: 'Request body failed schema validation.',
    },
    VALIDATION_REQUIRED_FIELD: {
        code: 'VALIDATION_REQUIRED_FIELD',
        httpStatus: 400,
        message: 'Required field missing',
        description: 'A required field is missing from the request.',
    },
    VALIDATION_INVALID_FORMAT: {
        code: 'VALIDATION_INVALID_FORMAT',
        httpStatus: 400,
        message: 'Invalid format',
        description: 'A field has an invalid format (e.g., invalid email, phone).',
    },
    VALIDATION_INVALID_ENUM: {
        code: 'VALIDATION_INVALID_ENUM',
        httpStatus: 400,
        message: 'Invalid value',
        description: 'Field value is not one of the allowed options.',
    },

    // ============================================================
    // USER ERRORS (4000-4999)
    // ============================================================
    USER_NOT_FOUND: {
        code: 'USER_NOT_FOUND',
        httpStatus: 404,
        message: 'User not found',
        description: 'No user exists with the given identifier.',
    },
    USER_ALREADY_EXISTS: {
        code: 'USER_ALREADY_EXISTS',
        httpStatus: 409,
        message: 'User already exists',
        description: 'A user with this email/phone already exists.',
    },
    USER_NOT_VERIFIED: {
        code: 'USER_NOT_VERIFIED',
        httpStatus: 403,
        message: 'Account not verified',
        description: 'User must verify their account before proceeding.',
    },
    USER_PROFILE_INCOMPLETE: {
        code: 'USER_PROFILE_INCOMPLETE',
        httpStatus: 400,
        message: 'Profile incomplete',
        description: 'User must complete their profile before proceeding.',
    },

    // ============================================================
    // HOSPITAL ERRORS (5000-5999)
    // ============================================================
    HOSPITAL_NOT_FOUND: {
        code: 'HOSPITAL_NOT_FOUND',
        httpStatus: 404,
        message: 'Hospital not found',
        description: 'No hospital exists with the given identifier.',
    },
    HOSPITAL_NOT_VERIFIED: {
        code: 'HOSPITAL_NOT_VERIFIED',
        httpStatus: 403,
        message: 'Hospital not verified',
        description: 'Hospital must be verified before performing this action.',
    },
    HOSPITAL_SUSPENDED: {
        code: 'HOSPITAL_SUSPENDED',
        httpStatus: 403,
        message: 'Hospital suspended',
        description: 'Hospital account is currently suspended.',
    },

    // ============================================================
    // DOCTOR ERRORS (6000-6999)
    // ============================================================
    DOCTOR_NOT_FOUND: {
        code: 'DOCTOR_NOT_FOUND',
        httpStatus: 404,
        message: 'Doctor not found',
        description: 'No doctor exists with the given identifier.',
    },
    DOCTOR_NOT_AVAILABLE: {
        code: 'DOCTOR_NOT_AVAILABLE',
        httpStatus: 400,
        message: 'Doctor not available',
        description: 'Doctor is not accepting appointments at this time.',
    },
    DOCTOR_NOT_VERIFIED: {
        code: 'DOCTOR_NOT_VERIFIED',
        httpStatus: 403,
        message: 'Doctor not verified',
        description: 'Doctor profile is pending verification.',
    },

    // ============================================================
    // APPOINTMENT ERRORS (7000-7999)
    // ============================================================
    APPOINTMENT_NOT_FOUND: {
        code: 'APPOINTMENT_NOT_FOUND',
        httpStatus: 404,
        message: 'Appointment not found',
        description: 'No appointment exists with the given identifier.',
    },
    APPOINTMENT_SLOT_UNAVAILABLE: {
        code: 'APPOINTMENT_SLOT_UNAVAILABLE',
        httpStatus: 409,
        message: 'Slot not available',
        description: 'The selected time slot is no longer available.',
    },
    APPOINTMENT_SLOT_LOCKED: {
        code: 'APPOINTMENT_SLOT_LOCKED',
        httpStatus: 409,
        message: 'Slot locked by another user',
        description: 'Another user is currently booking this slot.',
    },
    APPOINTMENT_INVALID_STATUS: {
        code: 'APPOINTMENT_INVALID_STATUS',
        httpStatus: 400,
        message: 'Invalid appointment status',
        description: 'Cannot perform this action on appointment in current status.',
    },
    APPOINTMENT_ALREADY_CANCELLED: {
        code: 'APPOINTMENT_ALREADY_CANCELLED',
        httpStatus: 400,
        message: 'Appointment already cancelled',
        description: 'This appointment has already been cancelled.',
    },
    APPOINTMENT_PAST_DATE: {
        code: 'APPOINTMENT_PAST_DATE',
        httpStatus: 400,
        message: 'Cannot book past date',
        description: 'Appointment date must be in the future.',
    },
    APPOINTMENT_TOO_LATE_TO_CANCEL: {
        code: 'APPOINTMENT_TOO_LATE_TO_CANCEL',
        httpStatus: 400,
        message: 'Too late to cancel',
        description: 'Appointment cannot be cancelled this close to start time.',
    },

    // ============================================================
    // PAYMENT ERRORS (8000-8999)
    // ============================================================
    PAYMENT_NOT_FOUND: {
        code: 'PAYMENT_NOT_FOUND',
        httpStatus: 404,
        message: 'Payment not found',
        description: 'No payment exists with the given identifier.',
    },
    PAYMENT_FAILED: {
        code: 'PAYMENT_FAILED',
        httpStatus: 400,
        message: 'Payment failed',
        description: 'Payment could not be processed.',
    },
    PAYMENT_VERIFICATION_FAILED: {
        code: 'PAYMENT_VERIFICATION_FAILED',
        httpStatus: 400,
        message: 'Payment verification failed',
        description: 'Payment signature verification failed.',
    },
    PAYMENT_ALREADY_PROCESSED: {
        code: 'PAYMENT_ALREADY_PROCESSED',
        httpStatus: 409,
        message: 'Payment already processed',
        description: 'This payment has already been completed.',
    },
    PAYMENT_EXPIRED: {
        code: 'PAYMENT_EXPIRED',
        httpStatus: 400,
        message: 'Payment order expired',
        description: 'Payment order has expired. Please create a new one.',
    },
    REFUND_NOT_ALLOWED: {
        code: 'REFUND_NOT_ALLOWED',
        httpStatus: 400,
        message: 'Refund not allowed',
        description: 'This payment is not eligible for refund.',
    },
    REFUND_ALREADY_PROCESSED: {
        code: 'REFUND_ALREADY_PROCESSED',
        httpStatus: 409,
        message: 'Refund already processed',
        description: 'A refund has already been issued for this payment.',
    },
    REFUND_EXCEEDS_AMOUNT: {
        code: 'REFUND_EXCEEDS_AMOUNT',
        httpStatus: 400,
        message: 'Refund exceeds payment amount',
        description: 'Requested refund amount exceeds original payment.',
    },

    // ============================================================
    // PRESCRIPTION ERRORS (9000-9999)
    // ============================================================
    PRESCRIPTION_NOT_FOUND: {
        code: 'PRESCRIPTION_NOT_FOUND',
        httpStatus: 404,
        message: 'Prescription not found',
        description: 'No prescription exists with the given identifier.',
    },
    PRESCRIPTION_EXPIRED: {
        code: 'PRESCRIPTION_EXPIRED',
        httpStatus: 400,
        message: 'Prescription expired',
        description: 'This prescription has expired.',
    },
    PRESCRIPTION_ALREADY_FULFILLED: {
        code: 'PRESCRIPTION_ALREADY_FULFILLED',
        httpStatus: 409,
        message: 'Prescription already fulfilled',
        description: 'This prescription has already been dispensed.',
    },

    // ============================================================
    // HEALTH RECORD ERRORS (10000-10999)
    // ============================================================
    RECORD_NOT_FOUND: {
        code: 'RECORD_NOT_FOUND',
        httpStatus: 404,
        message: 'Health record not found',
        description: 'No health record exists with the given identifier.',
    },
    RECORD_ACCESS_DENIED: {
        code: 'RECORD_ACCESS_DENIED',
        httpStatus: 403,
        message: 'Access to record denied',
        description: 'User does not have permission to access this record.',
    },
    RECORD_UPLOAD_FAILED: {
        code: 'RECORD_UPLOAD_FAILED',
        httpStatus: 400,
        message: 'Document upload failed',
        description: 'Health document upload failed.',
    },

    // ============================================================
    // INTEGRATION ERRORS (11000-11999)
    // ============================================================
    RAZORPAY_ERROR: {
        code: 'RAZORPAY_ERROR',
        httpStatus: 502,
        message: 'Payment gateway error',
        description: 'Error communicating with Razorpay payment gateway.',
    },
    RAZORPAY_CIRCUIT_OPEN: {
        code: 'RAZORPAY_CIRCUIT_OPEN',
        httpStatus: 503,
        message: 'Payment service temporarily unavailable',
        description: 'Payment gateway circuit breaker is open.',
    },
    SMS_SEND_FAILED: {
        code: 'SMS_SEND_FAILED',
        httpStatus: 502,
        message: 'Failed to send SMS',
        description: 'Error sending SMS via MSG91/Twilio.',
    },
    EMAIL_SEND_FAILED: {
        code: 'EMAIL_SEND_FAILED',
        httpStatus: 502,
        message: 'Failed to send email',
        description: 'Error sending email via SMTP/Nodemailer.',
    },
    WHATSAPP_SEND_FAILED: {
        code: 'WHATSAPP_SEND_FAILED',
        httpStatus: 502,
        message: 'Failed to send WhatsApp message',
        description: 'Error sending WhatsApp message.',
    },
} as const;

/**
 * Error code type
 */
export type ErrorCode = keyof typeof ERROR_CODES;

/**
 * Get error details by code
 */
export const getErrorByCode = (code: ErrorCode) => ERROR_CODES[code];

/**
 * Check if a code is a valid error code
 */
export const isValidErrorCode = (code: string): code is ErrorCode => {
    return code in ERROR_CODES;
};
