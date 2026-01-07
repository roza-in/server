/**
 * ROZX Healthcare Platform - Production Configuration Constants
 * All business logic constants, fees, and configuration values
 */

// =============================================================================
// Platform Fee Configuration
// =============================================================================

export const PLATFORM_FEES = {
  // Consultation fees (percentage)
  PERCENTAGE: 7,
  ONLINE_CONSULTATION: 7,
  IN_PERSON_PREBOOKED: 4,
  WALKIN: 2,
  FOLLOWUP: 3,
  
  // Fixed fees (in paisa)
  MINIMUM_FEE: 2000, // ₹20 minimum
  MAXIMUM_FEE: 50000, // ₹500 maximum
  
  // Subscription fees
  HOSPITAL_BASIC_MONTHLY: 0,
  HOSPITAL_PREMIUM_MONTHLY: 499900, // ₹4,999
  HOSPITAL_ENTERPRISE_MONTHLY: 999900, // ₹9,999
} as const;

export const GST_RATE = 18; // 18% GST on platform fees

// =============================================================================
// Appointment Configuration
// =============================================================================

export const APPOINTMENT_DURATIONS = {
  DEFAULT: 15, // minutes
  MINIMUM: 10,
  MAXIMUM: 60,
  VIDEO: 20,
  IN_PERSON: 15,
  CHAT: 30,
} as const;

export const APPOINTMENT_LIMITS = {
  MAX_ADVANCE_BOOKING_DAYS: 60,
  MIN_ADVANCE_BOOKING_HOURS: 1,
  MAX_DAILY_APPOINTMENTS_PATIENT: 3,
  MAX_RESCHEDULES: 2,
  NO_SHOW_TIMEOUT_MINUTES: 20,
  EARLY_JOIN_MINUTES: 10,
} as const;

// =============================================================================
// Payment Configuration
// =============================================================================

export const PAYMENT_CONFIG = {
  TIMEOUT_MINUTES: 15,
  CURRENCY: 'INR',
  MIN_AMOUNT: 10000, // ₹100 in paisa
  MAX_AMOUNT: 10000000, // ₹1,00,000 in paisa
} as const;

export const REFUND_POLICY = {
  // Hours before appointment for different refund percentages
  FULL_REFUND_HOURS: 24,
  PARTIAL_75_HOURS: 4,
  PARTIAL_50_HOURS: 1,
  NO_REFUND_HOURS: 0,
  
  // Percentages
  FULL_PERCENT: 100,
  PARTIAL_75_PERCENT: 75,
  PARTIAL_50_PERCENT: 50,
  
  // Credits for cancellation by provider
  DOCTOR_CANCEL_CREDIT: 5000, // ₹50 in paisa
} as const;

// =============================================================================
// OTP Configuration
// =============================================================================

export const OTP_CONFIG = {
  LENGTH: 6,
  EXPIRY_MINUTES: 10,
  MAX_ATTEMPTS: 3,
  RESEND_COOLDOWN_SECONDS: 60,
  RATE_LIMIT_PER_HOUR: 5,
} as const;

// =============================================================================
// Session Configuration
// =============================================================================

export const SESSION_CONFIG = {
  ACCESS_TOKEN_EXPIRY: '1h',
  REFRESH_TOKEN_EXPIRY: '30d',
  SESSION_DURATION_DAYS: 30,
  MAX_SESSIONS_PER_USER: 5,
} as const;

// =============================================================================
// Rate Limiting Configuration
// =============================================================================

export const RATE_LIMITS = {
  DEFAULT: { windowMs: 60000, max: 100 },
  AUTH: { windowMs: 60000, max: 10 },
  OTP: { windowMs: 60000, max: 3 },
  BOOKING: { windowMs: 60000, max: 20 },
  SEARCH: { windowMs: 60000, max: 60 },
  UPLOAD: { windowMs: 60000, max: 10 },
  WEBHOOK: { windowMs: 1000, max: 100 },
} as const;

// =============================================================================
// Video Consultation Configuration (Agora)
// =============================================================================

export const VIDEO_CONFIG = {
  TOKEN_EXPIRY_SECONDS: 3600, // 1 hour
  CHANNEL_PREFIX: 'rozx_consultation_',
  ROLES: {
    PUBLISHER: 1,
    SUBSCRIBER: 2,
  },
  PRIVILEGES: {
    JOIN_CHANNEL: 'joinChannel',
    PUBLISH_AUDIO: 'publishAudioStream',
    PUBLISH_VIDEO: 'publishVideoStream',
    PUBLISH_DATA: 'publishDataStream',
  },
} as const;

// =============================================================================
// WhatsApp Configuration
// =============================================================================

export const WHATSAPP_CONFIG = {
  API_VERSION: 'v18.0',
  TEMPLATES: {
    OTP: 'otp_verification',
    APPOINTMENT_BOOKED: 'appointment_booked',
    APPOINTMENT_REMINDER: 'appointment_reminder_24h',
    APPOINTMENT_CANCELLED: 'appointment_cancelled',
    PAYMENT_SUCCESS: 'payment_success',
    CONSULTATION_STARTING: 'consultation_starting',
    PRESCRIPTION_READY: 'prescription_ready',
    WELCOME: 'welcome_message',
  },
  MESSAGE_TYPES: {
    TEMPLATE: 'template',
    TEXT: 'text',
    IMAGE: 'image',
    DOCUMENT: 'document',
  },
} as const;

// =============================================================================
// File Upload Configuration
// =============================================================================

export const UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'image/jpeg', 'image/png'],
  IMAGE_QUALITY: 80,
  THUMBNAIL_SIZE: 200,
} as const;

// =============================================================================
// Pagination Configuration
// =============================================================================

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// =============================================================================
// Notification Configuration
// =============================================================================

export const NOTIFICATION_CONFIG = {
  CHANNELS: {
    WHATSAPP: 'whatsapp',
    SMS: 'sms',
    EMAIL: 'email',
    PUSH: 'push',
    IN_APP: 'in_app',
  },
  QUIET_HOURS: {
    START: '22:00',
    END: '07:00',
  },
  BATCH_SIZE: 100,
} as const;

// =============================================================================
// Verification Timeouts
// =============================================================================

export const VERIFICATION_CONFIG = {
  HOSPITAL_REVIEW_DAYS: 3,
  DOCTOR_REVIEW_DAYS: 2,
  DOCUMENT_EXPIRY_DAYS: 365,
} as const;

// =============================================================================
// Search Configuration
// =============================================================================

export const SEARCH_CONFIG = {
  MIN_QUERY_LENGTH: 2,
  MAX_RESULTS: 50,
  TYPEAHEAD_DELAY_MS: 300,
} as const;

// =============================================================================
// Status Constants
// =============================================================================

export const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
  PENDING_VERIFICATION: 'pending_verification',
} as const;

export const VERIFICATION_STATUS = {
  PENDING: 'pending',
  IN_REVIEW: 'in_review',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
} as const;

export const APPOINTMENT_STATUS = {
  PENDING_PAYMENT: 'pending_payment',
  CONFIRMED: 'confirmed',
  CHECKED_IN: 'checked_in',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
  RESCHEDULED: 'rescheduled',
} as const;

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  REFUND_PROCESSING: 'refund_processing',
} as const;

// =============================================================================
// HTTP Status Codes
// =============================================================================

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

// =============================================================================
// Response Messages
// =============================================================================

export const MESSAGES = {
  SUCCESS: 'Operation successful',
  CREATED: 'Resource created successfully',
  UPDATED: 'Resource updated successfully',
  DELETED: 'Resource deleted successfully',
  
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logout successful',
  OTP_SENT: 'OTP sent successfully',
  OTP_VERIFIED: 'OTP verified successfully',
  TOKEN_REFRESHED: 'Token refreshed successfully',
  
  UNAUTHORIZED: 'Authentication required',
  FORBIDDEN: 'Access denied',
  NOT_FOUND: 'Resource not found',
  VALIDATION_ERROR: 'Validation failed',
  INTERNAL_ERROR: 'Internal server error',
  RATE_LIMIT_EXCEEDED: 'Too many requests, please try again later',
  
  APPOINTMENT_BOOKED: 'Appointment booked successfully',
  APPOINTMENT_CANCELLED: 'Appointment cancelled successfully',
  APPOINTMENT_RESCHEDULED: 'Appointment rescheduled successfully',
  SLOT_NOT_AVAILABLE: 'Selected time slot is not available',
  
  PAYMENT_INITIATED: 'Payment initiated',
  PAYMENT_SUCCESS: 'Payment successful',
  PAYMENT_FAILED: 'Payment failed',
  REFUND_INITIATED: 'Refund initiated',
  REFUND_PROCESSED: 'Refund processed successfully',
} as const;

// =============================================================================
// Days of Week
// =============================================================================

export const DAYS_OF_WEEK = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

// =============================================================================
// Indian States
// =============================================================================

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
] as const;
