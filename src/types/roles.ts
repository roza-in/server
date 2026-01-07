/**
 * User Role Types
 */

export const USER_ROLES = {
  PATIENT: 'patient',
  DOCTOR: 'doctor',
  HOSPITAL: 'hospital',
  ADMIN: 'admin',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

/**
 * Role hierarchy for permission checking
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  patient: 1,
  doctor: 2,
  hospital: 3,
  admin: 4,
};

/**
 * Check if a role has permission level
 */
export const hasRolePermission = (
  userRole: UserRole,
  requiredRole: UserRole
): boolean => {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
};

/**
 * Role-based route access
 */
export const ROLE_PERMISSIONS = {
  // Patient permissions
  patient: [
    'view:own_profile',
    'update:own_profile',
    'view:hospitals',
    'view:doctors',
    'book:appointment',
    'view:own_appointments',
    'cancel:own_appointment',
    'view:own_prescriptions',
    'view:own_health_records',
    'upload:documents',
    'view:own_payments',
    'create:review',
  ],

  // Doctor permissions (includes patient permissions + doctor-specific)
  doctor: [
    'view:own_profile',
    'update:own_profile',
    'view:assigned_appointments',
    'update:appointment_status',
    'create:prescription',
    'view:patient_history',
    'update:consultation_notes',
    'view:own_schedule',
    'view:own_analytics',
  ],

  // Hospital permissions (includes doctor permissions + hospital-specific)
  hospital: [
    'view:own_profile',
    'update:own_profile',
    'manage:doctors',
    'manage:schedules',
    'view:all_appointments',
    'manage:appointments',
    'view:analytics',
    'view:payments',
    'manage:settings',
    'view:patients',
    'manage:walkin_bookings',
    'view:reports',
  ],

  // Admin permissions (full access)
  admin: [
    'manage:all',
    'verify:hospitals',
    'verify:doctors',
    'view:platform_analytics',
    'manage:users',
    'manage:platform_settings',
    'view:audit_logs',
    'manage:support',
    'manage:billing',
  ],
} as const;

export type Permission = (typeof ROLE_PERMISSIONS)[UserRole][number];

/**
 * Check if a role has a specific permission
 */
export const hasPermission = (
  userRole: UserRole,
  permission: string
): boolean => {
  // Admin has all permissions
  if (userRole === 'admin') {
    return true;
  }

  const rolePermissions = ROLE_PERMISSIONS[userRole] as readonly string[];
  return rolePermissions.includes(permission);
};

/**
 * Get all permissions for a role
 */
export const getRolePermissions = (role: UserRole): readonly string[] => {
  return ROLE_PERMISSIONS[role];
};
