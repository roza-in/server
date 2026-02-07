// Auth middleware - authentication and session handling
export {
  authMiddleware,
} from './auth.middleware.js';

// Role middleware - role and permission based access control
export {
  roleGuard,
} from './role.middleware.js';

export * from './error.middleware.js';
export * from './rate-limit.middleware.js';
export * from './validate.middleware.js';
export * from './hospital-scope.middleware.js';
export * from './audit.middleware.js';
export * from './request-id.middleware.js';
