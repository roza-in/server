import type { UserRole, Gender, BloodGroup } from '../../types/database.types.js';

// ============================================================================
// User Module Types
// ============================================================================

export interface UserProfile {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    avatar_url: string | null;
    role: UserRole;
    gender: Gender | null;
    date_of_birth: string | null;
    blood_group: BloodGroup | null;
    address: UserAddress | null;
    emergency_contact: EmergencyContact | null;
    is_active: boolean;
    is_blocked: boolean;
    blocked_reason: string | null;
    password_hash: string | null;
    google_id: string | null;
    email_verified: boolean;
    phone_verified: boolean;
    last_login_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface UserAddress {
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    landmark?: string;
}

export interface EmergencyContact {
    name?: string;
    phone?: string;
    relationship?: string;
}

export interface UserListItem {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    avatar_url: string | null;
    role: UserRole;
    is_active: boolean;
    is_blocked: boolean;
    created_at: string;
    last_login_at: string | null;
}

export interface UserFilters {
    search?: string;
    role?: UserRole;
    isActive?: boolean;
    isBlocked?: boolean;
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

export interface UserStats {
    totalUsers: number;
    activeUsers: number;
    blockedUsers: number;
    patientCount: number;
    doctorCount: number;
    hospitalCount: number;
    newUsersToday: number;
    newUsersThisWeek: number;
}


