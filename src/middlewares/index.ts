// Auth middleware - authentication and session handling
export {
  authenticate,
  optionalAuth,
  requireVerifiedDoctor,
  requireVerifiedHospital,
  verifyRefreshToken,
  // Ownership checks from auth middleware
  requireDoctorOwner,
  requireHospitalOwner,
  requireOwnerOrAdmin,
  // Role shortcuts
  adminOnly,
  hospitalOnly,
  doctorOnly,
  patientOnly,
  // Utilities
  extractDeviceInfo,
  getClientIP,
} from './auth.middleware.js';

// Role middleware - role and permission based access control
export {
  requireRole,
  requirePermission,
} from './role.middleware.js';

export * from './error.middleware.js';
export * from './rate-limit.middleware.js';
export * from './validate.middleware.js';
