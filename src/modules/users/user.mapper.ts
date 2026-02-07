
import type { UserProfile } from '../auth/auth.types.js';

/**
 * Format user profile including nested relations
 */
export function formatUserProfile(user: any, hospitalId?: string, doctorId?: string): UserProfile {
    return {
        id: user.id,
        phone: user.phone,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatar_url,
        profile_picture_url: user.avatar_url,
        profilePictureUrl: user.avatar_url,
        phoneVerified: user.phone_verified,
        emailVerified: user.email_verified,
        isActive: user.is_active,
        isBlocked: user.is_blocked,
        blockedReason: user.blocked_reason,
        gender: user.gender,
        dateOfBirth: user.date_of_birth,
        doctor: user.doctors?.[0] ? {
            ...user.doctors[0],
            isActive: user.doctors[0].is_active,
        } : null,
        hospital: user.hospitals?.[0] ? {
            ...user.hospitals[0],
            isActive: user.hospitals[0].is_active,
        } : (user.staff?.[0]?.hospital ? {
            ...user.staff[0].hospital,
            isActive: user.staff[0].hospital.is_active,
        } : null),
        hospitalId,
        doctorId,
        lastLoginAt: user.last_login_at,
        createdAt: user.created_at,
        doctors: user.doctors || [],
        // hospitals: user.hospitals || [],
    };
}

/**
 * Map raw user entity (with joined details) to UserProfile
 */
export function mapUserToProfile(user: any): UserProfile {
    const doctors = user.doctors || [];
    const hospitals = user.hospitals || [];

    // Calculate IDs falling back to staff relation for hospital ID
    const hospitalId = hospitals?.[0]?.id || doctors?.[0]?.hospital_id || user.staff?.[0]?.hospital?.id;
    const doctorId = doctors?.[0]?.id;

    return formatUserProfile(user, hospitalId, doctorId);
}
