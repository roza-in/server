import type { UserRole, OTPPurpose, Hospital, Doctor, Gender, BloodGroup } from '../../types/database.types.js';

/**
 * Auth Module Types — production-ready, aligned with DB schema
 */

// ============================================================================
// Token / Session
// ============================================================================

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// ============================================================================
// User Profile (API response shape — camelCase)
// ============================================================================

export interface UserProfile {
  id: string;
  phone: string | null;
  email: string | null;
  name: string;
  role: UserRole;
  avatarUrl: string | null;
  coverUrl: string | null;
  phoneVerified: boolean;
  emailVerified: boolean;
  isActive: boolean;
  isBlocked: boolean;
  blockedReason?: string | null;
  gender?: Gender | null;
  dateOfBirth?: string | null;
  bloodGroup?: BloodGroup | null;
  address?: Record<string, unknown> | null;
  emergencyContact?: Record<string, unknown> | null;
  allergies?: string[] | null;
  medicalConditions?: string[] | null;
  verificationStatus?: string;
  hospitalId?: string;
  doctorId?: string;
  doctor?: Partial<Doctor> | null;
  hospital?: Partial<Hospital> | null;
  lastLoginAt?: string | null;
  createdAt: string;
}

// ============================================================================
// Auth Responses
// ============================================================================

export interface LoginResponse {
  user: UserProfile;
  tokens: AuthTokens;
  isNewUser: boolean;
}

export interface OTPSendResponse {
  message: string;
  phone?: string;
  email?: string;
  expiresIn: number;
}

// ============================================================================
// Auth Inputs (non-Zod — service-layer contracts)
// ============================================================================

export interface PasswordLoginInput {
  email: string;
  password: string;
}

export interface GoogleOAuthData {
  iss: string;
  azp: string;
  aud: string;
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  locale?: string;
}

export interface GoogleOAuthInput {
  idToken: string;
  deviceInfo?: DeviceInfo;
  ipAddress?: string;
  userAgent?: string;
}

// ============================================================================
// Device / Session
// ============================================================================

export interface DeviceInfo {
  deviceId?: string;
  deviceName?: string;
  deviceType?: 'mobile' | 'tablet' | 'desktop' | 'other';
  os?: string;
  osVersion?: string;
  browser?: string;
  browserVersion?: string;
}

export interface SessionInfo {
  id: string;
  userId: string;
  deviceInfo?: DeviceInfo;
  ipAddress?: string;
  userAgent?: string;
  isActive: boolean;
  lastUsedAt: string;
  createdAt: string;
}

