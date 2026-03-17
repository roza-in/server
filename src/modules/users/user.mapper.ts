
import type { UserProfile } from '../auth/auth.types.js';

/**
 * Format user DB row + joined relations into a clean API UserProfile.
 * Expects the shape returned by UserRepository.findWithDetails().
 */
export function formatUserProfile(user: any, hospitalId?: string, doctorId?: string): UserProfile {
    return {
        id: user.id,
        phone: user.phone,
        email: user.email,
        name: user.name,
        role: user.role,
        ...(user.role === 'admin' ? { admin_tier: user.admin_tier ?? null } : {}),
        avatarUrl: user.avatar_url ?? null,
        coverUrl: user.cover_url ?? null,
        phoneVerified: user.phone_verified ?? false,
        emailVerified: user.email_verified ?? false,
        isActive: user.is_active ?? true,
        isBlocked: user.is_blocked ?? false,
        blockedReason: user.blocked_reason ?? null,
        gender: user.gender ?? null,
        dateOfBirth: user.date_of_birth ?? null,
        bloodGroup: user.blood_group ?? null,
        address: user.address ?? null,
        emergencyContact: user.emergency_contact ?? null,
        allergies: user.allergies ?? null,
        medicalConditions: user.medical_conditions ?? null,
        verificationStatus: user.verification_status,
        doctor: user.doctors?.[0]
            ? { ...user.doctors[0], isActive: user.doctors[0].is_active }
            : null,
        hospital: user.hospitals?.[0]
            ? { ...user.hospitals[0], isActive: user.hospitals[0].is_active }
            : (user.staff?.[0]?.hospital
                ? { ...user.staff[0].hospital, isActive: user.staff[0].hospital.is_active }
                : null),
        hospitalId,
        doctorId,
        lastLoginAt: user.last_login_at ?? null,
        createdAt: user.created_at,
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
