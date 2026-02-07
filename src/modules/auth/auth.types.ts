import type { UserRole, OTPPurpose, Hospital, Doctor, Gender } from '../../types/database.types.js';

/**
 * Auth Module Types
 */

// ============================================================================
// Request/Response Types
// ============================================================================

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserProfile {
  id: string;
  phone: string;
  email: string | null;
  name: string | null;
  role: UserRole;
  avatarUrl: string | null;
  profile_picture_url?: string | null;
  profilePictureUrl?: string | null;
  phoneVerified: boolean;
  emailVerified: boolean;
  isActive: boolean;
  isBlocked: boolean;
  blockedReason?: string | null;
  gender?: Gender | null;
  dateOfBirth?: string | null;
  hospitalId?: string;
  doctorId?: string;
  doctor?: Doctor | null;
  hospital?: Hospital | null;
  lastLoginAt?: string | null;
  createdAt: string;
  // For compatibility with legacy code or specific UI needs
  doctors?: Doctor[];
  hospitals?: Hospital[];
}

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
  otp?: string; // Only in development
}

// ============================================================================
// Google OAuth
// ============================================================================

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
  deviceInfo?: any;
  ipAddress?: string;
  userAgent?: string;
}

export interface PasswordLoginInput {
  email: string;
  password: string;
}

// ============================================================================
// WhatsApp OTP
// ============================================================================

export interface WhatsAppOTPInput {
  phone: string;
  purpose: OTPPurpose;
}

export interface WhatsAppOTPVerifyInput {
  phone: string;
  code: string;
  purpose: OTPPurpose;
}

// ============================================================================
// Registration Data
// ============================================================================

export interface RegisterPatientData {
  phone: string;
  otp: string;
  name: string;
  email?: string;
  password?: string;
  gender?: Gender;
  dateOfBirth?: string;
}

export interface RegisterHospitalData {
  phone: string;
  otp: string;
  name: string;
  email?: string;
  password?: string;
  hospital: {
    name: string;
    type?: string;
    registrationNumber?: string;
    phone: string;
    email?: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    landmark?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    about?: string;
    specialties?: string[];
    facilities?: string[];
  };
}

export interface AddDoctorData {
  userId: string;
  hospitalId: string;
  specializationId?: string;
  medicalRegistrationNumber: string;
  title: string;
  qualifications?: any;
  experienceYears: number;
  bio?: string;
  languagesSpoken?: string[];
  consultationFeeOnline: number;
  consultationFeeInPerson: number;
  consultationFeeWalkIn?: number;
  consultationDuration?: number;
  acceptsOnline?: boolean;
  acceptsInPerson?: boolean;
  acceptsWalkIn?: boolean;
}

// ============================================================================
// Session Types
// ============================================================================

export interface SessionData {
  id: string;
  userId: string;
  deviceInfo?: any;
  ipAddress?: string;
  userAgent?: string;
  location?: any;
  isActive: boolean;
  lastActivityAt: string;
  createdAt: string;
}

export interface DeviceInfo {
  deviceId?: string;
  deviceName?: string;
  deviceType?: 'mobile' | 'tablet' | 'desktop' | 'other';
  os?: string;
  osVersion?: string;
  browser?: string;
  browserVersion?: string;
}

