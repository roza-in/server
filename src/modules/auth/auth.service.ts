import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getSupabaseAdmin } from '../../config/db.js';
import { generateTokenPair, TokenPayload, verifyRefreshToken } from '../../config/jwt.js';
import { env, isDevelopment } from '../../config/env.js';
import { logger } from '../../common/logger.js';
import { notificationService } from '../../services/notifications/notification.service.js';
import type { NotificationPurpose } from '../../services/notifications/types.js';
import { UserNotFoundError, UserAlreadyExistsError, OTPExpiredError, OTPInvalidError, MaxOTPAttemptsError, BadRequestError, UnauthorizedError } from '../../common/errors.js';
import type { AuthTokens, LoginResponse, OTPSendResponse, GoogleOAuthData, UserProfile, PasswordLoginInput } from './auth.types.js';
import type { SendOTPInput, VerifyOTPInput, RegisterPatientInput, RegisterHospitalInput, RefreshTokenInput } from './auth.validator.js';
import type { OTPChannel, OTPPurpose, UserSession, UserRole } from '../../types/database.types.js';

const SESSION_EXPIRES_DAYS = 30;
const OTP_TO_NOTIFICATION_PURPOSE: Partial<Record<OTPPurpose, NotificationPurpose>> = {
  login: 'OTP_LOGIN',
  registration: 'OTP_REGISTRATION',
};

/**
 * Auth Service - Production-ready authentication with WhatsApp OTP, Google OAuth, and session management
 * OTP delivery currently uses Meta WhatsApp Cloud via notification service
 */
class AuthService {
  private logger = logger.child('AuthService');
  private supabase = getSupabaseAdmin();
  private readonly saltRounds = 10;

  // =================================================================
  // OTP Management
  // =================================================================

  /**
   * Generate a random OTP code
   */
  private generateOTP(): string {
    const length = env.OTP_LENGTH;
    return crypto.randomInt(Math.pow(10, length - 1), Math.pow(10, length)).toString();
  }

  /**
   * Send OTP using Supabase + SMS delivery
   */
  async sendOTP(data: SendOTPInput): Promise<OTPSendResponse> {
    const { phone, email, purpose } = data;
    const identifier = phone || email;

    if (!identifier) {
      throw new BadRequestError('Phone number is required for OTP');
    }

    if (!phone) {
      throw new BadRequestError('A phone number is required for SMS OTP delivery');
    }

    // Validate purpose-specific requirements
    if (purpose === 'login') {
      // Check if user exists
      let query = this.supabase.from('users').select('id, is_active, is_blocked');
      
      if (phone) {
        query = query.eq('phone', phone);
      } else {
        query = query.eq('email', email);
      }

      const { data: user } = await query.single();

      if (!user) {
        throw new UserNotFoundError('No account found with this phone number or email');
      }
      if (user.is_blocked) {
        throw new UnauthorizedError('Your account has been blocked');
      }
      if (!user.is_active) {
        throw new UnauthorizedError('Your account is inactive');
      }
    }

    // Generate OTP code
    const code = this.generateOTP();
    const expiresAt = new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000);

    // Store OTP in database
    const { data: otpRecord, error } = await this.supabase
      .from('otp_codes')
      .insert({
        phone: phone || null,
        email: email || null,
        otp: code,
        purpose: purpose as OTPPurpose,
        channel: 'sms' as OTPChannel,
        expires_at: expiresAt.toISOString(),
        attempts: 0,
        verified: false,
      })
      .select()
      .single();

    const otpId = (otpRecord as { id?: string })?.id;

    if (error || !otpRecord) {
      this.logger.error('Failed to create OTP record', error);
      throw new BadRequestError('Failed to send OTP');
    }

    // Dispatch via SMS using notification service
    try {
      await this.sendOTPViaSMS(phone, code, purpose as OTPPurpose);
    } catch (sendError) {
      // Clean up the OTP record if delivery fails
      if (otpId) {
        await this.supabase.from('otp_codes').delete().eq('id', otpId);
      }
      this.logger.error('Failed to send OTP via SMS', sendError);
      throw new BadRequestError('Failed to send OTP via SMS');
    }

    this.logger.info(`OTP generated for ${identifier}: ${isDevelopment ? code : '✓'}`);

    // In development, log the OTP for testing
    if (isDevelopment) {
      this.logger.info(`[DEV] OTP Code: ${code} - Valid for ${env.OTP_EXPIRY_MINUTES} minutes`);
    }

    return {
      message: 'OTP sent successfully via SMS',
      phone: phone || undefined,
      email: email || undefined,
      expiresIn: env.OTP_EXPIRY_MINUTES * 60,
      // Only return OTP in development
      ...(isDevelopment && { otp: code }),
    };
  }

  /**
   * Backward compatible helper for WhatsApp OTP
   */
  async sendWhatsAppOTP(data: SendOTPInput): Promise<OTPSendResponse> {
    return this.sendOTP(data);
  }

  /**
   * Verify OTP (for phone or email)
   */
  private async verifyOTP(identifier: string, code: string, purpose: OTPPurpose): Promise<void> {
    // Query by phone or email
    let query = this.supabase
      .from('otp_codes')
      .select('*')
      .eq('purpose', purpose)
      .eq('verified', false)
      .order('created_at', { ascending: false })
      .limit(1);

    // Dynamic filter based on identifier type
    if (identifier.includes('@')) {
      query = query.eq('email', identifier);
    } else {
      query = query.eq('phone', identifier);
    }

    const { data: otpRecord, error } = await query.single();

    if (error || !otpRecord) {
      throw new OTPInvalidError('Invalid or expired OTP');
    }

    const otp = otpRecord as any;

    // Check expiry
    if (new Date() > new Date(otp.expires_at)) {
      await this.supabase.from('otp_codes').delete().eq('id', otp.id);
      throw new OTPExpiredError();
    }

    // Check max attempts
    if (otp.attempts >= env.OTP_MAX_ATTEMPTS) {
      await this.supabase.from('otp_codes').delete().eq('id', otp.id);
      throw new MaxOTPAttemptsError();
    }

    // Verify code
    if (otp.otp !== code) {
      await this.supabase
        .from('otp_codes')
        .update({ attempts: (otp.attempts || 0) + 1 })
        .eq('id', otp.id);
      throw new OTPInvalidError('Invalid OTP code');
    }

    // Mark as verified and delete
    await this.supabase.from('otp_codes').delete().eq('id', otp.id);
    
    this.logger.info(`OTP verified successfully for ${identifier}`);
  }

  /**
   * Send SMS/Email OTP (placeholder - implement with SMS service like Twilio)
   * For now, OTP is generated and stored in DB
   */
  private async sendOTPViaSMS(phone: string, code: string, purpose: OTPPurpose): Promise<void> {
    const notificationPurpose = OTP_TO_NOTIFICATION_PURPOSE[purpose];

    if (!notificationPurpose) {
      this.logger.warn('Unsupported OTP purpose for SMS delivery', { purpose });
      throw new BadRequestError('Unsupported OTP purpose');
    }

    await notificationService.send({
      phone,
      purpose: notificationPurpose,
      channel: 'sms',
      variables: {
        otp: code,
        expiry: String(env.OTP_EXPIRY_MINUTES),
      },
    });
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
    sessionId: string,
    deviceInfo?: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<UserSession> {
    const expiresAt = new Date(Date.now() + SESSION_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

    const { data: sessionData, error } = await this.supabase
      .from('user_sessions')
      .insert({
        id: sessionId,
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

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
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
   * Note: This is for login only. Use registerPatient/registerHospital for registration.
   */
  async loginWithOTP(data: VerifyOTPInput, deviceInfo?: any, ipAddress?: string, userAgent?: string): Promise<LoginResponse> {
    const { phone, email, otp, purpose = 'login', password } = data as any;
    const identifier = phone || email;

    // Reject registration attempts - use registerPatient endpoint instead
    if (purpose === 'registration') {
      throw new BadRequestError('For registration, use POST /api/v1/auth/register/patient with OTP, fullName, etc.');
    }

    if (!identifier) {
      throw new BadRequestError('Phone number or email is required');
    }

    // Verify OTP
    await this.verifyOTP(identifier, otp, purpose);

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

    let user = userData as any;

    // Check user status
    if (user.is_blocked) {
      throw new UnauthorizedError(`Account blocked: ${user.blocked_reason || 'Contact support'}`);
    }
    if (!user.is_active) {
      throw new UnauthorizedError('Account is inactive');
    }

    // If a password is provided and user has no password set, hash & set now (post-OTP verification)
    if (password && !user.password_hash) {
      const passwordHash = await this.hashPassword(password);
      await this.supabase
        .from('users')
        .update({ password_hash: passwordHash })
        .eq('id', user.id);
      user = { ...user, password_hash: passwordHash };
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
    const sessionId = crypto.randomUUID();

    const tokenPayload: Omit<TokenPayload, 'iat' | 'exp' | 'iss'> = {
      userId: user.id,
      role: user.role,
      phone: user.phone,
      email: user.email,
      hospitalId,
      doctorId,
      sessionId,
    };

    const tokens = generateTokenPair(tokenPayload);

    // Create session with the same sessionId used in JWT
    await this.createSession(user.id, tokens.refreshToken, sessionId, deviceInfo, ipAddress, userAgent);

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
   * Login with email + password
   */
  async loginWithPassword(data: PasswordLoginInput, deviceInfo?: any, ipAddress?: string, userAgent?: string): Promise<LoginResponse> {
    const { email, password } = data;

    const { data: userData, error } = await this.supabase
      .from('users')
      .select(`
        *,
        doctors!doctors_user_id_fkey(id, hospital_id),
        hospitals!hospitals_admin_user_id_fkey(id)
      `)
      .ilike('email', email)
      .single();

    if (error || !userData) {
      throw new UserNotFoundError('No account found with this email');
    }

    const user = userData as any;

    if (user.is_blocked) {
      throw new UnauthorizedError(`Account blocked: ${user.blocked_reason || 'Contact support'}`);
    }
    if (!user.is_active) {
      throw new UnauthorizedError('Account is inactive');
    }
    if (!user.password_hash) {
      throw new UnauthorizedError('Password login is not enabled for this account');
    }

    const isValid = await this.verifyPassword(password, user.password_hash);
    if (!isValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    await this.supabase
      .from('users')
      .update({
        last_login_at: new Date().toISOString(),
        email_verified: true,
        email_verified_at: user.email_verified_at || new Date().toISOString(),
      })
      .eq('id', user.id);

    const doctors = user.doctors as any[];
    const hospitals = user.hospitals as any[];
    const hospitalId = hospitals?.[0]?.id || doctors?.[0]?.hospital_id;
    const doctorId = doctors?.[0]?.id;

    const sessionId = crypto.randomUUID();

    const tokenPayload: Omit<TokenPayload, 'iat' | 'exp' | 'iss'> = {
      userId: user.id,
      role: user.role,
      phone: user.phone,
      email: user.email,
      hospitalId,
      doctorId,
      sessionId,
    };

    const tokens = generateTokenPair(tokenPayload);

    await this.createSession(user.id, tokens.refreshToken, sessionId, deviceInfo, ipAddress, userAgent);

    return {
      user: this.formatUserProfile(user, hospitalId, doctorId),
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: 3600,
      },
      isNewUser: false,
    };
  }

  /**
   * Register patient with OTP
   */
  async registerPatient(data: RegisterPatientInput, deviceInfo?: any, ipAddress?: string, userAgent?: string): Promise<LoginResponse> {
    const { phone, otp, fullName, email, password, gender, dateOfBirth } = data;

    // Determine which identifier was used for OTP (in this case, always phone)
    // Verify OTP
    await this.verifyOTP(phone, otp, 'registration');

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
    const passwordHash = password ? await this.hashPassword(password) : null;

    const { data: userData, error } = await this.supabase
      .from('users')
      .insert({
        phone,
        full_name: fullName,
        email: email || null,
        role: 'patient' as UserRole,
        phone_verified: true,
        phone_verified_at: new Date().toISOString(),
        password_hash: passwordHash,
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

    // Note: patient_credits are created automatically by database trigger
    // when a patient user is inserted

    // Note: notification_preferences are created automatically by database trigger
    // when a user is inserted

    // Generate tokens
    const sessionId = crypto.randomUUID();

    const tokenPayload: Omit<TokenPayload, 'iat' | 'exp' | 'iss'> = {
      userId: user.id,
      role: 'patient',
      phone: user.phone,
      email: user.email,
      sessionId,
    };

    const tokens = generateTokenPair(tokenPayload);

    // Create session with matching sessionId
    await this.createSession(user.id, tokens.refreshToken, sessionId, deviceInfo, ipAddress, userAgent);

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
    const { phone, otp, fullName, email, password, hospital } = data;

    // Verify OTP
    await this.verifyOTP(phone, otp, 'registration');

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
    const passwordHash = password ? await this.hashPassword(password) : null;

    const { data: userData, error: userError } = await this.supabase
      .from('users')
      .insert({
        phone,
        full_name: fullName,
        email: email || null,
        role: 'hospital' as UserRole,
        phone_verified: true,
        phone_verified_at: new Date().toISOString(),
        password_hash: passwordHash,
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

    // Note: notification_preferences are created automatically by database trigger
    // when a user is inserted

    // Generate tokens
    const sessionId = crypto.randomUUID();

    const tokenPayload: Omit<TokenPayload, 'iat' | 'exp' | 'iss'> = {
      userId: user.id,
      role: 'hospital',
      phone: user.phone,
      email: user.email,
      hospitalId: hospital_record.id,
      sessionId,
    };

    const tokens = generateTokenPair(tokenPayload);

    // Create session with matching sessionId
    await this.createSession(user.id, tokens.refreshToken, sessionId, deviceInfo, ipAddress, userAgent);

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
      // Generate a strong random password for OAuth-created users and store its hash
      const randomPassword = crypto.randomBytes(24).toString('hex');
      const passwordHash = await this.hashPassword(randomPassword);

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
          password_hash: passwordHash,
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
      // Ensure existing OAuth user has a password hash set (so password login can be enabled later)
      if (!user.password_hash) {
        const randomPassword = crypto.randomBytes(24).toString('hex');
        const passwordHash = await this.hashPassword(randomPassword);
        updates.password_hash = passwordHash;
      }

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
    const sessionId = crypto.randomUUID();

    const tokenPayload: Omit<TokenPayload, 'iat' | 'exp' | 'iss'> = {
      userId: user.id,
      role: user.role,
      phone: user.phone,
      email: user.email,
      hospitalId,
      doctorId,
      sessionId,
    };

    const tokens = generateTokenPair(tokenPayload);

    // Create session with matching sessionId
    await this.createSession(user.id, tokens.refreshToken, sessionId, deviceInfo, ipAddress, userAgent);

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

    // Extract hospital/doctor IDs for token compatibility
    const doctors = (user as any).doctors as any[];
    const hospitals = (user as any).hospitals as any[];
    const hospitalId = hospitals?.[0]?.id || doctors?.[0]?.hospital_id;
    const doctorId = doctors?.[0]?.id;

    // Return formatted profile to keep API consistent with login responses
    return this.formatUserProfile(user as any, hospitalId, doctorId) as UserProfile;
  }

  // =================================================================
  // Helpers
  // =================================================================

  /**
   * Format user profile for API response
   */
  private formatUserProfile(user: any, hospitalId?: string, doctorId?: string) {
    const doctors = user.doctors as any[];
    const hospitals = user.hospitals as any[];
    const doctor = doctors?.[0] || null;
    const hospital = hospitals?.[0] || null;

    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      avatarUrl: user.avatar_url,
      // Provide both snake_case and camelCase keys for frontend compatibility
      profile_picture_url: user.avatar_url,
      profilePictureUrl: user.avatar_url,
      phoneVerified: user.phone_verified,
      emailVerified: user.email_verified,
      doctor,
      hospital,
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
