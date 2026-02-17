import type { UserRole, Gender, BloodGroup, VerificationStatus } from '../../types/database.types.js';

// ============================================================================
// User Module Types — aligned with DB schema (002_users_auth.sql)
// ============================================================================

/**
 * Full user profile as returned from DB (snake_case columns).
 * Used internally for service-layer logic and admin views.
 */
export interface UserProfile {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    password_hash: string | null;
    role: UserRole;
    avatar_url: string | null;
    cover_url: string | null;
    date_of_birth: string | null;
    gender: Gender | null;
    blood_group: BloodGroup | null;
    address: UserAddress | null;
    medical_conditions: string[] | null;
    allergies: string[] | null;
    emergency_contact: EmergencyContact | null;
    is_active: boolean;
    is_blocked: boolean;
    blocked_reason: string | null;
    email_verified: boolean;
    phone_verified: boolean;
    verification_status: VerificationStatus;
    verified_at: string | null;
    last_login_at: string | null;
    login_count: number;
    created_at: string;
    updated_at: string;
}

export interface UserAddress {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    landmark?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
}

export interface EmergencyContact {
    name?: string;
    phone?: string;
    relationship?: string;
}

/**
 * Lightweight user row for admin list views
 */
export interface UserListItem {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
    role: UserRole;
    is_active: boolean;
    is_blocked: boolean;
    verification_status: VerificationStatus;
    created_at: string;
    last_login_at: string | null;
}

export interface UserFilters {
    search?: string;
    role?: UserRole;
    is_active?: boolean;
    is_blocked?: boolean;
    page?: number;
    limit?: number;
    sortBy?: 'name' | 'email' | 'created_at' | 'last_login_at';
    sortOrder?: 'asc' | 'desc';
}

export interface UserListResponse {
    users: UserListItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

/**
 * Matches the shape returned by userRepository.getStats()
 */
export interface UserStats {
    total: number;
    patients: number;
    doctors: number;
    hospitals: number;
}


