import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getSupabaseAdmin } from '../../config/db.js';
import { generateTokenPair, TokenPayload, verifyRefreshToken } from '../../config/jwt.js';
import { env, isDevelopment } from '../../config/env.js';
import { logger } from '../../common/logger.js';
import {
  UserNotFoundError,
  UserAlreadyExistsError,
  OTPExpiredError,
  OTPInvalidError,
  MaxOTPAttemptsError,
  BadRequestError,
  UnauthorizedError,
} from '../../common/errors.js';
import type {
  AuthTokens,
  LoginResponse,
  OTPSendResponse,
  GoogleOAuthData,
  UserProfile,
} from './auth.types.js';
import type {
  SendOTPInput,
  VerifyOTPInput,
  RegisterPatientInput,
  RegisterHospitalInput,
  RefreshTokenInput,
} from './auth.validator.js';
import type {
  OTPPurpose,
  UserSession,
  UserRole,
} from '../../types/database.types.js';

const SESSION_EXPIRES_DAYS = 30;

/**
 * Auth Service - Production-ready authentication with OTP (SMS/Email), Google OAuth, and session management
 * Supports phone and email-based authentication via Supabase OTP system
 */
class AuthService {
  private logger = logger.child('AuthService');
  private supabase = getSupabaseAdmin();

  // =================================================================
  // OTP Management
  // =================================================================

  /**
   * Send OTP using Supabase Auth
   * Supabase handles OTP generation and delivery via SMS or Email
   */
  async sendOTP(data: SendOTPInput): Promise<OTPSendResponse> {
    const { phone, email, purpose } = data;
    const identifier = phone || email;

    if (!identifier) {
      throw new BadRequestError('Phone number or email is required');
    }

    // Normalize phone number to E.164 format (+country_code + number)
    let normalizedPhone = phone;
    if (phone) {
      // Remove spaces, dashes, and parentheses
      normalizedPhone = phone.replace(/[\s\-()]/g, '');
      // Ensure it starts with +
      if (!normalizedPhone.startsWith('+')) {
        // If no +, assume it's a 10-digit number and add India prefix
        if (normalizedPhone.match(/^\d{10}$/)) {
          normalizedPhone = '+91' + normalizedPhone;
        } else {
          throw new BadRequestError('Phone number must be in valid format (e.g., +911234567890 or 10-digit number)');
        }
      }
    }

    // For login, validate user exists
    if (purpose === 'login' && phone) {
      const { data: user } = await this.supabase
        .from('users')
        .select('id, is_active, is_blocked')
        .eq('phone', phone)
        .single();

      if (!user) {
        throw new UserNotFoundError('No account found with this phone number');
      }
      if (user.is_blocked) {
        throw new UnauthorizedError('Your account has been blocked');
      }
      if (!user.is_active) {
        throw new UnauthorizedError('Your account is inactive');
      }
    }

    // Use Supabase Auth signInWithOtp with normalized phone
    try {
      const { error } = await this.supabase.auth.signInWithOtp({
        phone: normalizedPhone || undefined,
        email: email || undefined,
      });

      if (error) {
        this.logger.error('Failed to send OTP via Supabase Auth', error);
        throw new BadRequestError('Failed to send OTP. Please try again.');
      }

      this.logger.info('OTP sent successfully via Supabase Auth', { identifier, purpose });
    }
    catch (error) {
      if (error instanceof BadRequestError) throw error;
      this.logger.error('Error sending OTP', error);
      throw new BadRequestError('Failed to send OTP. Please try again.');
    }

    return {
      message: 'OTP sent successfully. Check your phone/email.',
      phone,
      email: email || undefined,
      expiresIn: 900, // Supabase default is 900 seconds (15 minutes)
    };
  }

  /**
   * Send OTP via Supabase Auth
   */
  async sendSupabaseOTP(data: SendOTPInput): Promise<OTPSendResponse> {
    return this.sendOTP(data);
  }

  /**
   * Verify OTP using Supabase Auth
   */
  private async verifyOTP(identifier: string, code: string): Promise<any> {
    // Normalize phone number to E.164 format if needed
    let normalizedPhone = identifier;
    if (identifier && !identifier.includes('@')) {
      // It's a phone number, normalize it
      normalizedPhone = identifier.replace(/[\s\-()]/g, '');
      if (!normalizedPhone.startsWith('+')) {
        if (normalizedPhone.match(/^\d{10}$/)) {
          normalizedPhone = '+91' + normalizedPhone;
        }
      }
    }

    // Supabase verifyOtp requires phone number with country code
    const isEmail = normalizedPhone.includes('@');
    const { data, error } = isEmail
      ? await this.supabase.auth.verifyOtp({
          email: normalizedPhone,
          token: code,
          type: 'email',
        })
      : await this.supabase.auth.verifyOtp({
          phone: normalizedPhone,
          token: code,
          type: 'sms',
        });

    if (error) {
      this.logger.error('OTP verification failed', { identifier, error });
      if (error.message?.toLowerCase().includes('expired') || error.code === 'otp_expired') {
        throw new OTPExpiredError();
      }
      if (error.message?.toLowerCase().includes('invalid') || error.code === 'otp_invalid') {
        throw new OTPInvalidError('Invalid OTP code');
      }
      throw new BadRequestError('OTP verification failed');
    }

    this.logger.info('OTP verified successfully', { identifier });
    return data;
  }

  // =================================================================
  // Session Management
  // =================================================================

  /**
   * Create user session
   */
  private async createSession(
    userId: string,
    refreshToken: string,
    deviceInfo?: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<UserSession> {
    const expiresAt = new Date(Date.now() + SESSION_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

    const { data: sessionData, error } = await this.supabase
      .from('user_sessions')
      .insert({
        user_id: userId,
        refresh_token: refreshToken,
        device_info: deviceInfo || null,
        ip_address: ipAddress || null,
        user_agent: userAgent || null,
        expires_at: expiresAt.toISOString(),
        is_active: true,
        last_active_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !sessionData) {
      this.logger.error('Failed to create session', error);
      throw new BadRequestError('Failed to create session');
    }

    return sessionData as any;
  }

  /**
   * Revoke user session
   */
  async revokeSession(sessionId: string): Promise<void> {
    await this.supabase
      .from('user_sessions')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_reason: 'user_logout',
      })
      .eq('id', sessionId);
  }

  /**
   * Revoke all user sessions
   */
  async revokeAllSessions(userId: string): Promise<void> {
    await this.supabase
      .from('user_sessions')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_reason: 'logout_all_devices',
      })
      .eq('user_id', userId)
      .eq('is_active', true);
  }

  // =================================================================
  // User Authentication
  // =================================================================

  /**
   * Login with OTP (phone or email)
   */
  async loginWithOTP(data: VerifyOTPInput, deviceInfo?: any, ipAddress?: string, userAgent?: string): Promise<LoginResponse> {
    const { phone, email, otp, purpose = 'login' } = data;
    const identifier = phone || email;

    if (!identifier) {
      throw new BadRequestError('Phone number or email is required');
    }

    // Verify OTP using Supabase Auth
    await this.verifyOTP(identifier, otp);

    // Get user with relations
    let query = this.supabase
      .from('users')
      .select(`
        *,
        doctors!doctors_user_id_fkey(id, hospital_id),
        hospitals!hospitals_admin_user_id_fkey(id)
      `);

    if (phone) {
      query = query.eq('phone', phone);
    } else {
      query = query.eq('email', email);
    }

    const { data: userData, error } = await query.single();

    if (error || !userData) {
      throw new UserNotFoundError();
    }

    const user = userData as any;

    // Check user status
    if (user.is_blocked) {
      throw new UnauthorizedError(`Account blocked: ${user.blocked_reason || 'Contact support'}`);
    }
    if (!user.is_active) {
      throw new UnauthorizedError('Account is inactive');
    }

    // Update last login
    await this.supabase
      .from('users')
      .update({ 
        last_login_at: new Date().toISOString(),
        phone_verified: phone ? true : user.phone_verified,
        phone_verified_at: phone && !user.phone_verified ? new Date().toISOString() : user.phone_verified_at,
        email_verified: email ? true : user.email_verified,
        email_verified_at: email && !user.email_verified ? new Date().toISOString() : user.email_verified_at,
      })
      .eq('id', user.id);

    // Get hospital/doctor IDs
    const doctors = user.doctors as any[];
    const hospitals = user.hospitals as any[];
    const hospitalId = hospitals?.[0]?.id || doctors?.[0]?.hospital_id;
    const doctorId = doctors?.[0]?.id;

    // Generate tokens
    const tokenPayload: Omit<TokenPayload, 'iat' | 'exp' | 'iss'> = {
      userId: user.id,
      role: user.role,
      phone: user.phone,
      email: user.email,
      hospitalId,
      doctorId,
      sessionId: crypto.randomUUID(),
    };

    const tokens = generateTokenPair(tokenPayload);

    // Create session
    await this.createSession(user.id, tokens.refreshToken, deviceInfo, ipAddress, userAgent);

    return {
      user: this.formatUserProfile(user, hospitalId, doctorId),
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: 3600, // 1 hour
      },
      isNewUser: false,
    };
  }

  /**
   * Register patient with OTP
   */
  async registerPatient(data: RegisterPatientInput, deviceInfo?: any, ipAddress?: string, userAgent?: string): Promise<LoginResponse> {
    const { phone, otp, fullName, email, gender, dateOfBirth } = data;

    // Verify OTP using Supabase Auth
    await this.verifyOTP(phone, otp);

    // Check if user already exists
    const { data: existingUser } = await this.supabase
      .from('users')
      .select('id')
      .eq('phone', phone)
      .single();

    if (existingUser) {
      throw new UserAlreadyExistsError('An account with this phone number already exists');
    }

    // Create user
    const { data: userData, error } = await this.supabase
      .from('users')
      .insert({
        phone,
        full_name: fullName,
        email: email || null,
        role: 'patient' as UserRole,
        phone_verified: true,
        phone_verified_at: new Date().toISOString(),
        gender: gender || null,
        date_of_birth: dateOfBirth || null,
        is_active: true,
        is_blocked: false,
      })
      .select()
      .single();

    if (error || !userData) {
      this.logger.error('Failed to create patient', error);
      throw new BadRequestError('Failed to create account');
    }

    const user = userData as any;

    // Create patient credits wallet with initial balance
    await this.supabase.from('patient_credits').insert({
      patient_id: user.id,
      amount: 0,
      balance: 0,
      source: 'registration',
      status: 'active',
    });

    // Create notification preferences
    await this.supabase.from('notification_preferences').insert({
      user_id: user.id,
    });

    // Generate tokens
    const tokenPayload: Omit<TokenPayload, 'iat' | 'exp' | 'iss'> = {
      userId: user.id,
      role: 'patient',
      phone: user.phone,
      email: user.email,
      sessionId: crypto.randomUUID(),
    };

    const tokens = generateTokenPair(tokenPayload);

    // Create session
    await this.createSession(user.id, tokens.refreshToken, deviceInfo, ipAddress, userAgent);

    return {
      user: this.formatUserProfile(user),
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: 3600,
      },
      isNewUser: true,
    };
  }

  /**
   * Register hospital with OTP
   */
  async registerHospital(data: RegisterHospitalInput, deviceInfo?: any, ipAddress?: string, userAgent?: string): Promise<LoginResponse> {
    const { phone, otp, fullName, email, hospital } = data;

    // Verify OTP using Supabase Auth
    await this.verifyOTP(phone, otp);

    // Check if user already exists
    const { data: existingUser } = await this.supabase
      .from('users')
      .select('id')
      .eq('phone', phone)
      .single();

    if (existingUser) {
      throw new UserAlreadyExistsError('An account with this phone number already exists');
    }

    // Generate unique slug
    let slug = this.createSlug(hospital.name);
    let counter = 0;
    while (true) {
      const checkSlug = counter > 0 ? `${slug}-${counter}` : slug;
      const { data: existing } = await this.supabase
        .from('hospitals')
        .select('id')
        .eq('slug', checkSlug)
        .single();
      
      if (!existing) {
        slug = checkSlug;
        break;
      }
      counter++;
    }

    // Create admin user
    const { data: userData, error: userError } = await this.supabase
      .from('users')
      .insert({
        phone,
        full_name: fullName,
        email: email || null,
        role: 'hospital' as UserRole,
        phone_verified: true,
        phone_verified_at: new Date().toISOString(),
        is_active: true,
        is_blocked: false,
        address: {
          line1: hospital.addressLine1,
          line2: hospital.addressLine2,
          city: hospital.city,
          state: hospital.state,
          pincode: hospital.pincode,
          latitude: hospital.latitude,
          longitude: hospital.longitude,
        },
      })
      .select()
      .single();

    if (userError || !userData) {
      this.logger.error('Failed to create hospital admin user', userError);
      throw new BadRequestError('Failed to create hospital account');
    }

    const user = userData as any;

    // Create hospital
    const { data: hospitalRecord, error: hospitalError } = await this.supabase
      .from('hospitals')
      .insert({
        admin_user_id: user.id,
        name: hospital.name,
        slug,
        type: (hospital.type as any) || 'multi_specialty',
        phone: hospital.phone,
        email: hospital.email || null,
        address_line1: hospital.addressLine1,
        address_line2: hospital.addressLine2 || null,
        city: hospital.city,
        state: hospital.state,
        pincode: hospital.pincode,
        location: hospital.latitude && hospital.longitude ? {
          type: 'Point',
          coordinates: [hospital.longitude, hospital.latitude],
        } : null,
        description: hospital.about || null,
        specializations: hospital.specialties || null,
        amenities: hospital.facilities || null,
        registration_number: hospital.registrationNumber || null,
        verification_status: 'pending',
        subscription_tier: 'free',
        is_active: true,
      })
      .select()
      .single();

    if (hospitalError || !hospitalRecord) {
      // Rollback user creation
      await this.supabase.from('users').delete().eq('id', user.id);
      this.logger.error('Failed to create hospital', hospitalError);
      throw new BadRequestError('Failed to create hospital');
    }

    const hospital_record = hospitalRecord as { id: string };

    // Create notification preferences
    await this.supabase.from('notification_preferences').insert({
      user_id: user.id,
    });

    // Generate tokens
    const tokenPayload: Omit<TokenPayload, 'iat' | 'exp' | 'iss'> = {
      userId: user.id,
      role: 'hospital',
      phone: user.phone,
      email: user.email,
      hospitalId: hospital_record.id,
      sessionId: crypto.randomUUID(),
    };

    const tokens = generateTokenPair(tokenPayload);

    // Create session
    await this.createSession(user.id, tokens.refreshToken, deviceInfo, ipAddress, userAgent);

    return {
      user: this.formatUserProfile(user, hospital_record.id),
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: 3600,
      },
      isNewUser: true,
    };
  }

  // =================================================================
  // Google OAuth
  // =================================================================

  /**
   * Google OAuth login/register
   */
  async googleOAuth(googleIdToken: string, deviceInfo?: any, ipAddress?: string, userAgent?: string): Promise<LoginResponse> {
    // Verify Google ID token
    let googleData: GoogleOAuthData;
    
    try {
      if (env.GOOGLE_CLIENT_ID) {
        // In production, verify with Google
        const response = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${googleIdToken}`
        );
        
        if (!response.ok) {
          throw new Error('Invalid Google token');
        }
        
        googleData = await response.json() as GoogleOAuthData;
        
        // Verify audience
        if (googleData.aud !== env.GOOGLE_CLIENT_ID) {
          throw new Error('Invalid token audience');
        }
      } else {
        // Development mode - decode without verification
        const decoded = jwt.decode(googleIdToken) as any;
        if (!decoded || !decoded.email) {
          throw new Error('Invalid token');
        }
        googleData = decoded;
      }
    } catch (error) {
      this.logger.error('Google token verification failed', error);
      throw new UnauthorizedError('Invalid Google token');
    }

    const email = googleData.email;
    const fullName = googleData.name || email.split('@')[0];
    const avatarUrl = googleData.picture || null;
    const googleId = googleData.sub;

    // Check if user exists
    const { data: existingUser } = await this.supabase
      .from('users')
      .select(`
        *,
        doctors!doctors_user_id_fkey(id, hospital_id),
        hospitals!hospitals_admin_user_id_fkey(id)
      `)
      .eq('email', email)
      .single();

    let user = existingUser as any;
    let isNewUser = false;

    if (!user) {
      // Create new user (phone required, use empty string for Google OAuth users until phone is verified)
      const { data: newUserData, error } = await this.supabase
        .from('users')
        .insert({
          phone: '', // Google OAuth users need to add phone later
          email,
          full_name: fullName,
          role: 'patient' as UserRole,
          email_verified: true,
          email_verified_at: new Date().toISOString(),
          avatar_url: avatarUrl,
          google_id: googleId,
          is_active: true,
          is_blocked: false,
        })
        .select()
        .single();

      if (error || !newUserData) {
        this.logger.error('Failed to create user from Google OAuth', error);
        throw new BadRequestError('Failed to create account');
      }

      user = newUserData as any;

      // Create patient credits wallet with initial balance
      await this.supabase.from('patient_credits').insert({
        patient_id: user.id,
        amount: 0,
        balance: 0,
        source: 'registration',
        status: 'active',
      });

      // Create notification preferences
      await this.supabase.from('notification_preferences').insert({
        user_id: user.id,
      });

      isNewUser = true;
    } else {
      // Update existing user
      const updates: any = {
        last_login_at: new Date().toISOString(),
      };

      if (!user.google_id) {
        updates.google_id = googleId;
      }
      if (!user.avatar_url && avatarUrl) {
        updates.avatar_url = avatarUrl;
      }

      await this.supabase.from('users').update(updates).eq('id', user.id);
      user = { ...user, ...updates };
    }

    // Check user status
    if (user.is_blocked) {
      throw new UnauthorizedError(`Account blocked: ${user.blocked_reason || 'Contact support'}`);
    }

    // Get hospital/doctor IDs
    const doctors = user.doctors as any[];
    const hospitals = user.hospitals as any[];
    const hospitalId = hospitals?.[0]?.id || doctors?.[0]?.hospital_id;
    const doctorId = doctors?.[0]?.id;

    // Generate tokens
    const tokenPayload: Omit<TokenPayload, 'iat' | 'exp' | 'iss'> = {
      userId: user.id,
      role: user.role,
      phone: user.phone,
      email: user.email,
      hospitalId,
      doctorId,
      sessionId: crypto.randomUUID(),
    };

    const tokens = generateTokenPair(tokenPayload);

    // Create session
    await this.createSession(user.id, tokens.refreshToken, deviceInfo, ipAddress, userAgent);

    return {
      user: this.formatUserProfile(user, hospitalId, doctorId),
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: 3600,
      },
      isNewUser,
    };
  }

  // =================================================================
  // Token Management
  // =================================================================

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(data: RefreshTokenInput, deviceInfo?: any, ipAddress?: string, userAgent?: string): Promise<AuthTokens> {
    const { refreshToken: token } = data;

    // Verify refresh token
    const payload = verifyRefreshToken(token);
    if (!payload) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Check if session exists and is active
    const { data: sessionData } = await this.supabase
      .from('user_sessions')
      .select('*')
      .eq('refresh_token', token)
      .eq('is_active', true)
      .is('revoked_at', null)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (!sessionData) {
      throw new UnauthorizedError('Session expired or invalid');
    }

    const session = sessionData as any;

    // Get user
    const { data: userData } = await this.supabase
      .from('users')
      .select(`
        *,
        doctors!doctors_user_id_fkey(id, hospital_id),
        hospitals!hospitals_admin_user_id_fkey(id)
      `)
      .eq('id', payload.userId)
      .single();

    if (!userData) {
      throw new UnauthorizedError('User account is inactive');
    }

    const user = userData as any;

    if (!user.is_active || user.is_blocked) {
      throw new UnauthorizedError('User account is inactive');
    }

    // Get hospital/doctor IDs
    const doctors = user.doctors as any[];
    const hospitals = user.hospitals as any[];
    const hospitalId = hospitals?.[0]?.id || doctors?.[0]?.hospital_id;
    const doctorId = doctors?.[0]?.id;

    // Generate new tokens
    const tokenPayload: Omit<TokenPayload, 'iat' | 'exp' | 'iss'> = {
      userId: user.id,
      role: user.role,
      phone: user.phone,
      email: user.email,
      hospitalId,
      doctorId,
      sessionId: session.id,
    };

    const tokens = generateTokenPair(tokenPayload);

    // Update session with new refresh token
    await this.supabase
      .from('user_sessions')
      .update({
        refresh_token: tokens.refreshToken,
        last_active_at: new Date().toISOString(),
        device_info: deviceInfo || session.device_info,
        ip_address: ipAddress || session.ip_address,
        user_agent: userAgent || session.user_agent,
      })
      .eq('id', session.id);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: 3600,
    };
  }

  /**
   * Logout - revoke current session
   */
  async logout(sessionId: string): Promise<void> {
    await this.revokeSession(sessionId);
  }

  /**
   * Logout from all devices - revoke all sessions
   */
  async logoutAll(userId: string): Promise<void> {
    await this.revokeAllSessions(userId);
  }

  // =================================================================
  // User Profile
  // =================================================================

  /**
   * Get user profile
   */
  async getProfile(userId: string): Promise<UserProfile> {
    const { data: user, error } = await this.supabase
      .from('users')
      .select(`
        *,
        doctors!doctors_user_id_fkey(*),
        hospitals!hospitals_admin_user_id_fkey(*)
      `)
      .eq('id', userId)
      .single();

    if (error || !user) {
      throw new UserNotFoundError();
    }

    return user as UserProfile;
  }

  // =================================================================
  // Helpers
  // =================================================================

  /**
   * Format user profile for API response
   */
  private formatUserProfile(user: any, hospitalId?: string, doctorId?: string) {
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      avatarUrl: user.avatar_url,
      phoneVerified: user.phone_verified,
      emailVerified: user.email_verified,
      hospitalId,
      doctorId,
      createdAt: user.created_at,
    };
  }

  /**
   * Create slug from name
   */
  private createSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
}

// Export singleton instance
export const authService = new AuthService();
