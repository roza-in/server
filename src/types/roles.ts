/**
 * User Role Types - ROZX Healthcare Platform
 * 
 * Roles (from database migration 001_extensions_enums.sql):
 * - patient:    End user / consumer
 * - reception:  Hospital front-desk staff
 * - doctor:     Medical professional
 * - hospital:   Hospital owner / manager
 * - pharmacy:   ROZX pharmacy team
 * - admin:      Platform super admin
 */

export const USER_ROLES = {
  PATIENT: 'patient',
  RECEPTION: 'reception',
  DOCTOR: 'doctor',
  HOSPITAL: 'hospital',
  PHARMACY: 'pharmacy',
  ADMIN: 'admin',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

/**
 * Role hierarchy for permission checking
 * Higher number = more privileges
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  patient: 1,
  reception: 2,
  doctor: 3,
  hospital: 4,
  pharmacy: 4,  // Same level as hospital (different domain)
  admin: 5,
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
 * Role-based permissions
 * Each role has specific capabilities in the platform
 */
export const ROLE_PERMISSIONS = {
  // Patient permissions - core consumer features
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
    'view:medicines',
    'order:medicines',
    'view:own_orders',
  ],

  // Reception permissions - hospital front-desk operations
  reception: [
    'view:own_profile',
    'update:own_profile',
    'view:hospital_appointments',
    'create:walkin_booking',
    'checkin:patient',
    'view:hospital_doctors',
    'view:hospital_schedule',
    'process:cash_payment',
    'view:hospital_patients',
    'reschedule:appointment',
  ],

  // Doctor permissions - medical professional capabilities
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
    'start:consultation',
    'complete:consultation',
  ],

  // Hospital permissions - hospital management
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
    'manage:staff',
    'view:settlements',
  ],

  // Pharmacy permissions - medicine e-commerce operations
  pharmacy: [
    'view:own_profile',
    'update:own_profile',
    'view:medicines',
    'manage:medicines',
    'manage:inventory',
    'view:medicine_orders',
    'manage:medicine_orders',
    'confirm:order',
    'process:order_status',
    'dispatch:order',
    'view:prescriptions',
    'verify:prescription',
    'manage:pharmacy_settlements',
    'view:pharmacy_analytics',
  ],

  // Admin permissions - full platform access
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
    'manage:pharmacy',
    'manage:settlements',
    'impersonate:user',
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

/**
 * Check if a role is a staff role (works within an organization)
 */
export const isStaffRole = (role: UserRole): boolean => {
  return ['reception', 'doctor'].includes(role);
};

/**
 * Check if a role is an organization role (manages an entity)
 */
export const isOrganizationRole = (role: UserRole): boolean => {
  return ['hospital', 'pharmacy'].includes(role);
};

/**
 * Check if a role has platform-wide access
 */
export const isPlatformRole = (role: UserRole): boolean => {
  return ['pharmacy', 'admin'].includes(role);
};
