import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { env } from '../../config/env.js';
import { generateOTP, hashString } from '../../common/utils/crypto.js';
import { generateTokenPair, verifyRefreshToken } from '../../common/utils/jwt.js';
import { parseDurationToSeconds } from '../../common/utils/date.js';
import { logger } from '../../config/logger.js';
import { userRepository } from '../../database/repositories/user.repo.js';
import { sessionRepository } from '../../database/repositories/session.repo.js';
import { hospitalRepository } from '../../database/repositories/hospital.repo.js';
import type { TokenPayload } from '../../types/jwt.js';
import { UserNotFoundError, UserAlreadyExistsError, OTPInvalidError, BadRequestError, UnauthorizedError } from '../../common/errors/index.js';
import type { AuthTokens, LoginResponse, OTPSendResponse, UserProfile, PasswordLoginInput } from './auth.types.js';
import type { SendOTPInput, VerifyOTPInput, RegisterPatientInput, RegisterHospitalInput, RefreshTokenInput, UpdateProfileInput, CompleteUserRegistrationInput, RegisterHospitalProfileInput, RegisterHospitalComplianceInput, RegisterHospitalAddressInput, ResetPasswordInput } from './auth.validator.js';
import type { OTPPurpose, UserSession, UserRole } from '../../types/database.types.js';
import { getRedisClient, checkRateLimit } from '../../config/redis.js';
import { notificationService } from '../../integrations/notification/notification.service.js';
import { NotificationPurpose, NotificationChannel } from '../../integrations/notification/notification.types.js';
import { formatUserProfile, mapUserToProfile } from '../users/user.mapper.js';
import { platformConfigService } from '../platform-config/platform-config.service.js';

const SESSION_EXPIRES_DAYS = 30;

/**
 * Auth Service - Production-ready authentication with WhatsApp OTP, Google OAuth, and session management
 * OTP delivery currently uses Meta WhatsApp Cloud via notification service
 */
class AuthService {
  private log = logger.child('AuthService');
  private readonly saltRounds = 12; // S3: increased from 10 for stronger password hashing

  /** ------ Send OTP ------ */
  async sendOTP(data: SendOTPInput): Promise<OTPSendResponse> {
    const { phone, purpose, sessionId } = data;
    let { email } = data;

    if (!phone && !email) {
      throw new BadRequestError("Phone or email is required for OTP");
    }

    if (!sessionId) {
      throw new BadRequestError("Verification session is required");
    }

    // If only phone is provided, resolve the user's email for delivery.
    // OTP is still stored/verified by phone — email is only used for sending.
    let adminTier: string | null = null;
    try {
      const existingUser = phone
        ? await userRepository.findByPhone(phone)
        : await userRepository.findByEmail(email!);

      if (existingUser) {
        if (phone && !email && (existingUser as any).email) {
          email = (existingUser as any).email;
        }
        adminTier = (existingUser as any).admin_tier || null;
      }
    } catch {
      // Ignore — user may not exist yet (registration)
    }

    const redis = getRedisClient();

    const identifier = phone ?? email!;
    const otp = generateOTP();

    // Fetch dynamic OTP settings
    const otpSettings = await platformConfigService.getOTPSettings();
    const ttlSeconds = (otpSettings.expiry_minutes || 5) * 60;

    const rate = await checkRateLimit(
      `otp:${identifier}`,
      5,
      10 * 60 * 1000
    );

    if (!rate.allowed) {
      throw new BadRequestError(
        "Too many OTP requests. Please try again later."
      );
    }

    const redisKey = phone
      ? `otp:phone:${phone}`
      : `otp:email:${email}`;

    // Store hashed OTP — never persist plaintext OTP in Redis
    const otpHash = hashString(otp);

    await redis?.setex(
      redisKey,
      ttlSeconds,
      JSON.stringify({
        otp: otpHash,
        sessionId,
        adminTier,
        purpose,
        attempts: 0,
      })
    );

    this.log.info("OTP generated", {
      identifier,
      purpose,
      expiresIn: ttlSeconds,
    });

    await notificationService.send({
      purpose: purpose === "login" ? NotificationPurpose.OTP_LOGIN : NotificationPurpose.OTP_REGISTRATION,
      // Force email channel until WhatsApp/SMS templates are approved.
      // Once approved, remove the channel override to enable auto-fallback (WhatsApp → SMS → Email).
      channel: NotificationChannel.Email,
      phone: phone || undefined,
      email: email || undefined,
      variables: {
        otp,
        expiry: String(otpSettings.expiry_minutes || 5),
      },
      whatsappValues: [otp, String(otpSettings.expiry_minutes || 5)], // Positional variables for Interakt
    });

    return {
      message: "OTP sent successfully",
      phone: phone ?? undefined,
      email: email ?? undefined,
      expiresIn: ttlSeconds,
    };
  }

  /**
   * Validate OTP for registration (without deleting)
   * This allows pre-validating OTP before showing the profile form
   */
  async validateRegistrationOTP(phone: string, otp: string): Promise<{ valid: boolean }> {
    const redis = getRedisClient();
    const redisKey = `otp:phone:${phone}`;
    const otpData = await redis?.get(redisKey);

    if (!otpData) {
      throw new OTPInvalidError('Invalid or expired OTP');
    }

    const parsed = typeof otpData === 'string' ? JSON.parse(otpData) : otpData;
    const { otp: storedOtpHash, purpose: storedPurpose, attempts = 0 } = parsed;

    // C2: Enforce attempt limiting
    const otpSettings = await platformConfigService.getOTPSettings();
    const maxAttempts = otpSettings.max_attempts || 3;
    if (attempts >= maxAttempts) {
      await redis?.del(redisKey);
      throw new OTPInvalidError('Too many invalid attempts. Please request a new OTP.');
    }

    // Compare hashed OTP
    if (storedOtpHash !== hashString(otp)) {
      // Increment attempt counter
      const ttl = await redis?.ttl(redisKey);
      await redis?.setex(
        redisKey,
        ttl && ttl > 0 ? ttl : 300,
        JSON.stringify({ ...parsed, attempts: attempts + 1 })
      );
      throw new OTPInvalidError('Invalid OTP code');
    }

    if (storedPurpose !== 'registration') {
      throw new BadRequestError('OTP was not sent for registration');
    }

    this.log.info(`Registration OTP validated for ${phone}`);

    // Don't delete - OTP will be verified again during actual registration
    return { valid: true };
  }


  /**
   * Verify OTP (for phone or email)
   */
  private async verifyOTP(identifier: string, code: string, purpose: OTPPurpose, isEmail: boolean = false): Promise<void> {
    const redis = getRedisClient();
    const redisKey = isEmail ? `otp:email:${identifier}` : `otp:phone:${identifier}`;
    const otpData = await redis?.get(redisKey);

    if (!otpData) {
      throw new OTPInvalidError('Invalid or expired OTP');
    }

    // Upstash client returns parsed JSON if it was stored as JSON, or string
    const parsed = typeof otpData === 'string' ? JSON.parse(otpData) : otpData;
    const { otp: storedOtpHash, purpose: storedPurpose, attempts = 0 } = parsed;

    // C2: Enforce attempt limiting
    const otpSettings = await platformConfigService.getOTPSettings();
    const maxAttempts = otpSettings.max_attempts || 3;
    if (attempts >= maxAttempts) {
      await redis?.del(redisKey);
      throw new OTPInvalidError('Too many invalid attempts. Please request a new OTP.');
    }

    // Compare hashed OTP and purpose
    if (storedOtpHash !== hashString(code) || storedPurpose !== purpose) {
      // Increment attempt counter
      const ttl = await redis?.ttl(redisKey);
      await redis?.setex(
        redisKey,
        ttl && ttl > 0 ? ttl : 300,
        JSON.stringify({ ...parsed, attempts: attempts + 1 })
      );
      throw new OTPInvalidError('Invalid OTP code');
    }

    await redis?.del(redisKey);

    this.log.info(`OTP verified successfully for ${identifier}`);

  }

  // =================================================================
  // Session Management
  // =================================================================

  /**
   * Create user session
   */
  async createSession(
    userId: string,
    refreshToken: string,
    sessionId: string,
    deviceInfo?: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<UserSession> {
    const expiresAt = new Date(Date.now() + SESSION_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

    const sessionData = await sessionRepository.create({
      id: sessionId,
      user_id: userId,
      refresh_token_hash: hashString(refreshToken),
      token_family: sessionId, // Each login creates a new token family for rotation tracking
      previous_refresh_token_hash: null,
      device_id: deviceInfo?.deviceId || null,
      device_type: deviceInfo?.deviceType || null,
      device_name: deviceInfo?.deviceName || null,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      expires_at: expiresAt.toISOString(),
      is_active: true,
      last_used_at: new Date().toISOString(),
    } as any);

    if (!sessionData) {
      this.log.error('Failed to create session');
      throw new BadRequestError('Failed to create session');
    }

    return sessionData;
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
    await sessionRepository.revoke(sessionId);
  }

  /**
   * Revoke all user sessions
   */
  async revokeAllSessions(userId: string): Promise<void> {
    await sessionRepository.revokeAllForUser(userId);
  }

  // =================================================================
  // User Authentication
  // =================================================================

  /**
   * Login with OTP (phone or email)
   * Note: This is for login only. Use registerPatient/registerHospital for registration.
   */
  async loginWithOTP(data: VerifyOTPInput, deviceInfo?: any, ipAddress?: string, userAgent?: string): Promise<LoginResponse> {
    const { phone, email, otp, purpose = 'login' } = data;
    const identifier = phone || email;

    // Reject registration attempts - use registerPatient endpoint instead
    if (purpose === 'registration') {
      throw new BadRequestError('For registration, use POST /api/v1/auth/register/patient with OTP, name, etc.');
    }

    if (!identifier) {
      throw new BadRequestError('Phone number or email is required');
    }

    // Verify OTP
    await this.verifyOTP(identifier, otp, purpose as OTPPurpose, !!email);

    // Get user with relations
    const userResult = await userRepository.findWithDetails(identifier);

    if (!userResult) {
      throw new UserNotFoundError();
    }

    const user = userResult as any;

    // Check user status
    if (user.is_blocked) {
      throw new UnauthorizedError(`Account blocked: ${user.blocked_reason || 'Contact support'}`);
    }
    if (!user.is_active) {
      throw new UnauthorizedError('Account is inactive');
    }

    // Update last login + increment login_count
    await userRepository.update(user.id, {
      last_login_at: new Date().toISOString(),
      login_count: (user.login_count || 0) + 1,
      phone_verified: !!phone || user.phone_verified,
      email_verified: !!email || user.email_verified,
    } as any);

    // Get hospital/doctor IDs (check hospitals, doctors, or staff for hospital association)
    const hospitalId = user.hospitals?.[0]?.id || user.doctors?.[0]?.hospital_id || user.staff?.[0]?.hospital_id;
    const doctorId = user.doctors?.[0]?.id;

    // Generate tokens
    const sessionId = crypto.randomUUID();

    const tokenPayload: Omit<TokenPayload, 'iat' | 'exp' | 'iss'> = {
      userId: user.id,
      role: user.role,
      phone: user.phone,
      email: user.email,
      hospitalId,
      doctorId,
      sessionId, adminTier: user.admin_tier,
    };

    const tokens = generateTokenPair(tokenPayload);

    // Create session with the same sessionId used in JWT
    await this.createSession(user.id, tokens.refreshToken, sessionId, deviceInfo, ipAddress, userAgent);

    // Send Login Alert
    try {
      if (user.phone || user.email) {
        const loginDevice = deviceInfo?.deviceName || "Unknown Device";
        const loginTime = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
        const loginIp = ipAddress || "Unknown IP";
        await notificationService.send({
          purpose: NotificationPurpose.LOGIN_ALERT,
          phone: user.phone,
          email: user.email,
          variables: {
            device: loginDevice,
            time: loginTime,
            ip: loginIp,
          },
          // rozx_login_alert: {{1}}=device {{2}}=time {{3}}=ip
          whatsappValues: [loginDevice, loginTime, loginIp],
        });
      }
    } catch (error) {
      this.log.error("Failed to send login alert", { userId: user.id, error });
    }

    return {
      user: formatUserProfile(user, hospitalId, doctorId),
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: parseDurationToSeconds(env.JWT_ACCESS_TOKEN_EXPIRES_IN),
      },
      isNewUser: false,
    };
  }

  /**
   * Login with email + password
   */
  async loginWithPassword(data: PasswordLoginInput, deviceInfo?: any, ipAddress?: string, userAgent?: string): Promise<LoginResponse> {
    const { email, password } = data;

    const userResult = await userRepository.findWithDetails(email);

    if (!userResult) {
      throw new UserNotFoundError('No account found with this email');
    }

    const user = userResult as any;

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

    await userRepository.update(user.id, {
      last_login_at: new Date().toISOString(),
      login_count: (user.login_count || 0) + 1,
      email_verified: true,
    } as any);

    // Check hospitals, doctors, or staff for hospital association
    const hospitalId = user.hospitals?.[0]?.id || user.doctors?.[0]?.hospital_id || user.staff?.[0]?.hospital_id;
    const doctorId = user.doctors?.[0]?.id;

    const sessionId = crypto.randomUUID();

    const tokenPayload: Omit<TokenPayload, 'iat' | 'exp' | 'iss'> = {
      userId: user.id,
      role: user.role,
      phone: user.phone,
      email: user.email,
      hospitalId,
      doctorId,
      sessionId, adminTier: user.admin_tier,
    };

    const tokens = generateTokenPair(tokenPayload);

    await this.createSession(user.id, tokens.refreshToken, sessionId, deviceInfo, ipAddress, userAgent);

    return {
      user: formatUserProfile(user, hospitalId, doctorId),
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: parseDurationToSeconds(env.JWT_ACCESS_TOKEN_EXPIRES_IN),
      },
      isNewUser: false,
    };
  }

  /**
   * Complete Initial Account Registration (Step 2)
   */
  async completeUserRegistration(data: CompleteUserRegistrationInput, deviceInfo?: any, ipAddress?: string, userAgent?: string): Promise<LoginResponse> {
    const { phone, otp, password, name, email, role } = data;

    // Verify OTP
    await this.verifyOTP(phone, otp, 'registration');

    // Check if user already exists
    const existingUser = await userRepository.findByPhone(phone);
    if (existingUser) {
      throw new UserAlreadyExistsError('An account with this phone number already exists');
    }

    // Hash password
    const passwordHash = await this.hashPassword(password);

    // Create user
    const userData = await userRepository.create({
      phone,
      name,
      email: email || null,
      role: role as UserRole,
      phone_verified: true,
      password_hash: passwordHash,
      is_active: true,
      is_blocked: false,
    } as any);

    if (!userData) {
      throw new BadRequestError('Failed to create account');
    }

    const user = userData as any;

    // Generate session & tokens
    const sessionId = crypto.randomUUID();
    const tokenPayload: Omit<TokenPayload, 'iat' | 'exp' | 'iss'> = {
      userId: user.id,
      role: user.role,
      phone: user.phone,
      email: user.email,
      sessionId, adminTier: user.admin_tier,
    };

    const tokens = generateTokenPair(tokenPayload);
    await this.createSession(user.id, tokens.refreshToken, sessionId, deviceInfo, ipAddress, userAgent);

    // Send welcome email (fire-and-forget)
    this.sendWelcomeEmail(user.name || 'there', user.email, role === 'hospital' ? 'hospital' : 'patient');

    return {
      user: formatUserProfile(user),
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: parseDurationToSeconds(env.JWT_ACCESS_TOKEN_EXPIRES_IN),
      },
      isNewUser: true,
    };
  }

  /**
   * Hospital Step 3: Base Profile
   */
  async registerHospitalProfile(userId: string, data: RegisterHospitalProfileInput): Promise<any> {
    const { name, type, description, phone, email } = data;

    // Check if hospital already exists for this admin
    let hospital = await hospitalRepository.findByAdminId(userId);

    if (!hospital) {
      // Create new hospital entry
      let slug = this.createSlug(name);
      let counter = 0;
      let uniqueSlug = slug;
      while (true) {
        const checkSlug = counter > 0 ? `${slug}-${counter}` : slug;
        const existing = await hospitalRepository.findBySlug(checkSlug);
        if (!existing) {
          uniqueSlug = checkSlug;
          break;
        }
        counter++;
      }

      hospital = await hospitalRepository.create({
        admin_user_id: userId,
        name,
        slug: uniqueSlug,
        type: type as any,
        description,
        phone: phone || '',
        email: email || null,
      } as any);
    } else {
      // Update existing
      hospital = await hospitalRepository.update(hospital.id, {
        name,
        type: type as any,
        description,
        phone: phone || hospital.phone,
        email: email || hospital.email,
        updated_at: new Date().toISOString(),
      } as any);
    }

    return hospital;
  }

  /**
   * Hospital Step 4: Compliance
   */
  async registerHospitalCompliance(userId: string, data: RegisterHospitalComplianceInput): Promise<any> {
    const { registrationNumber, gstin, pan } = data;

    const hospital = await hospitalRepository.findByAdminId(userId);
    if (!hospital) {
      throw new BadRequestError('Hospital profile not found. Please complete step 3 first.');
    }

    return await hospitalRepository.update(hospital.id, {
      registration_number: registrationNumber,
      gstin: gstin || null,
      pan: pan || null,
      updated_at: new Date().toISOString(),
    } as any);
  }

  /**
   * Hospital Step 5: Address
   */
  async registerHospitalAddress(userId: string, data: RegisterHospitalAddressInput): Promise<any> {
    const { address, landmark, city, state, pincode } = data;

    const hospital = await hospitalRepository.findByAdminId(userId);
    if (!hospital) {
      throw new BadRequestError('Hospital profile not found. Please complete previous steps first.');
    }

    return await hospitalRepository.update(hospital.id, {
      address,
      landmark: landmark || null,
      city,
      state,
      pincode,
      updated_at: new Date().toISOString(),
      // Set to pending for initial complete registration
      verification_status: 'pending' as any,
    } as any);
  }

  /**
   * Register patient with OTP (Legacy/Shortcut)
   */
  async registerPatient(data: RegisterPatientInput, deviceInfo?: any, ipAddress?: string, userAgent?: string): Promise<LoginResponse> {
    const { phone, otp, name, email, password, gender, dateOfBirth } = data;

    // Verify OTP
    await this.verifyOTP(phone, otp, 'registration');

    // Check if user already exists
    const existingUser = await userRepository.findByPhone(phone);

    if (existingUser) {
      throw new UserAlreadyExistsError('An account with this phone number already exists');
    }

    // Create user
    const passwordHash = password ? await this.hashPassword(password) : null;

    const userData = await userRepository.create({
      phone,
      name: name,
      email: email || null,
      role: 'patient' as UserRole,
      phone_verified: true,
      password_hash: passwordHash,
      gender: gender || null,
      date_of_birth: dateOfBirth || null,
      is_active: true,
      is_blocked: false,
    } as any);

    if (!userData) {
      this.log.error('Failed to create patient');
      throw new BadRequestError('Failed to create account');
    }

    const user = userData as any;

    // Generate tokens
    const sessionId = crypto.randomUUID();

    const tokenPayload: Omit<TokenPayload, 'iat' | 'exp' | 'iss'> = {
      userId: user.id,
      role: 'patient',
      phone: user.phone,
      email: user.email,
      sessionId, adminTier: user.admin_tier,
    };

    const tokens = generateTokenPair(tokenPayload);

    // Create session with matching sessionId
    await this.createSession(user.id, tokens.refreshToken, sessionId, deviceInfo, ipAddress, userAgent);

    // Send welcome email (fire-and-forget)
    this.sendWelcomeEmail(user.name || name, user.email || email, 'patient');

    return {
      user: formatUserProfile(user),
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: parseDurationToSeconds(env.JWT_ACCESS_TOKEN_EXPIRES_IN),
      },
      isNewUser: true,
    };
  }

  /**
   * Register hospital with OTP
   */
  async registerHospital(data: RegisterHospitalInput, deviceInfo?: any, ipAddress?: string, userAgent?: string): Promise<LoginResponse> {
    const { phone, otp, name, email, password, hospital } = data;

    // Verify OTP
    await this.verifyOTP(phone, otp, 'registration');

    // Check if user already exists
    const existingUser = await userRepository.findByPhone(phone);

    if (existingUser) {
      throw new UserAlreadyExistsError('An account with this phone number already exists');
    }

    // Generate unique slug
    let slug = this.createSlug(hospital.name);
    let counter = 0;
    while (true) {
      const checkSlug = counter > 0 ? `${slug}-${counter}` : slug;
      const existing = await hospitalRepository.findBySlug(checkSlug);

      if (!existing) {
        slug = checkSlug;
        break;
      }
      counter++;
    }

    // Create admin user
    const passwordHash = password ? await this.hashPassword(password) : null;

    const userData = await userRepository.create({
      phone,
      name: name,
      email: email || null,
      role: 'hospital' as UserRole,
      phone_verified: true,
      password_hash: passwordHash,
    } as any);

    if (!userData) {
      this.log.error('Failed to create hospital admin user');
      throw new BadRequestError('Failed to create hospital account');
    }

    const user = userData as any;

    // Create hospital
    let hospitalRecord;
    try {
      hospitalRecord = await hospitalRepository.create({
        admin_user_id: user.id,
        name: hospital.name,
        slug,
        type: (hospital.type as any) || 'multi_specialty',
        phone: hospital.phone,
        email: hospital.email || null,
        address: hospital.address || null,
        city: hospital.city || null,
        state: hospital.state || null,
        pincode: hospital.pincode || null,
        landmark: hospital.landmark || null,
        country: hospital.country || 'India',
      } as any);
    } catch (error) {
      // Rollback user creation on ANY error
      this.log.error('Error creating hospital, rolling back user:', error);
      await userRepository.delete(user.id);
      throw error;
    }

    if (!hospitalRecord) {
      // Rollback user creation if null returned
      await userRepository.delete(user.id);
      this.log.error('Failed to create hospital (null result)');
      throw new BadRequestError('Failed to create hospital');
    }

    const hospital_record = hospitalRecord as any;

    // Generate tokens
    const sessionId = crypto.randomUUID();

    const tokenPayload: Omit<TokenPayload, 'iat' | 'exp' | 'iss'> = {
      userId: user.id,
      role: 'hospital',
      phone: user.phone,
      email: user.email,
      hospitalId: hospital_record.id,
      sessionId, adminTier: user.admin_tier,
    };

    const tokens = generateTokenPair(tokenPayload);

    // Create session with matching sessionId
    await this.createSession(user.id, tokens.refreshToken, sessionId, deviceInfo, ipAddress, userAgent);

    // Manually attach hospital to user for the response (since we just created it)
    user.hospitals = [hospital_record];

    // Send welcome email (fire-and-forget)
    this.sendWelcomeEmail(user.name || name, user.email || email, 'hospital');

    return {
      user: formatUserProfile(user, hospital_record.id),
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: parseDurationToSeconds(env.JWT_ACCESS_TOKEN_EXPIRES_IN),
      },
      isNewUser: true,
    };
  }

  // =================================================================
  // Password Management
  // =================================================================

  /**
   * Change password for an authenticated user (current + new password)
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    if (!(user as any).password_hash) {
      throw new BadRequestError('Password login is not enabled for this account. You may have registered via OTP or Google.');
    }

    const isValid = await this.verifyPassword(currentPassword, (user as any).password_hash);
    if (!isValid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    if (currentPassword === newPassword) {
      throw new BadRequestError('New password must be different from current password');
    }

    const passwordHash = await this.hashPassword(newPassword);

    await userRepository.update(userId, {
      password_hash: passwordHash,
      updated_at: new Date().toISOString(),
    } as any);

    this.log.info(`Password changed successfully for user ${userId}`);

    return { message: 'Password has been changed successfully.' };
  }

  /**
   * Request a password reset — sends OTP to user's phone
   */
  async requestPasswordReset(phone: string): Promise<{ message: string; expiresIn: number }> {
    // Verify user exists
    const user = await userRepository.findByPhone(phone);
    if (!user) {
      // Don't reveal whether user exists — return same response
      const otpSettings = await platformConfigService.getOTPSettings();
      return { message: 'If an account exists, a password reset OTP has been sent.', expiresIn: (otpSettings.expiry_minutes || 5) * 60 };
    }

    // Send OTP with password_reset purpose
    const result = await this.sendOTP({
      phone,
      purpose: 'password_reset' as any,
      sessionId: crypto.randomUUID(),
    });

    return { message: 'If an account exists, a password reset OTP has been sent.', expiresIn: result.expiresIn };
  }

  /**
   * Reset password using OTP verification
   */
  async resetPassword(data: ResetPasswordInput): Promise<{ message: string }> {
    const { phone, otp, newPassword } = data;

    // Verify OTP with password_reset purpose
    await this.verifyOTP(phone, otp, 'password_reset' as any);

    // Find user
    const user = await userRepository.findByPhone(phone);
    if (!user) {
      throw new UserNotFoundError();
    }

    // Hash new password
    const passwordHash = await this.hashPassword(newPassword);

    // Update password
    await userRepository.update(user.id, {
      password_hash: passwordHash,
      updated_at: new Date().toISOString(),
    } as any);

    // Invalidate all existing sessions (force re-login)
    await this.revokeAllSessions(user.id);

    this.log.info(`Password reset successful for user ${user.id}`);

    return { message: 'Password has been reset successfully. Please login with your new password.' };
  }

  // =================================================================
  // Helpers
  // =================================================================

  /**
   * Send a welcome email after registration (fire-and-forget).
   * Never throws — logs errors silently so registration is not affected.
   */
  private sendWelcomeEmail(name: string, email: string | null | undefined, role: 'patient' | 'hospital' | 'doctor'): void {
    if (!email) return;

    const purposeMap = {
      patient: NotificationPurpose.WELCOME_PATIENT,
      hospital: NotificationPurpose.WELCOME_HOSPITAL,
      doctor: NotificationPurpose.WELCOME_DOCTOR,
    } as const;

    // Build role-specific subdomain URL based on environment:
    //   local:       http://{role}.rozx.local:3000
    //   development: https://{role}.dev.rozx.in
    //   production:  https://{role}.rozx.in
    const cookieDomain = env.COOKIE_DOMAIN || '.rozx.in';
    const baseDomain = cookieDomain.startsWith('.') ? cookieDomain.slice(1) : cookieDomain;
    const isLocal = env.NODE_ENV === 'local';
    const protocol = isLocal ? 'http' : 'https';
    const port = isLocal ? ':3000' : '';
    const appUrl = `${protocol}://${role}.${baseDomain}${port}`;

    notificationService.send({
      purpose: purposeMap[role],
      channel: NotificationChannel.Email,
      email,
      variables: { name, app_url: appUrl },
      whatsappValues: [name],
    }).catch(err => {
      this.log.error('Failed to send welcome email', { email, role, error: err instanceof Error ? err.message : String(err) });
    });
  }

  // =================================================================
  // Token Management
  // =================================================================

  /**
   * Refresh access token using refresh token with rotation & reuse detection.
   * - Each refresh rotates the token: old hash is stored as previous_refresh_token_hash.
   * - If a consumed (rotated-out) token is replayed, the entire session family is revoked
   *   to mitigate token theft.
   */
  async refreshAccessToken(data: RefreshTokenInput, deviceInfo?: any, ipAddress?: string, userAgent?: string): Promise<AuthTokens & { expiresIn: number }> {
    const { refreshToken: token } = data;

    if (!token) {
      throw new UnauthorizedError('Refresh token is required');
    }

    // Verify refresh token
    const payload = verifyRefreshToken(token);
    if (!payload) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const tokenHash = hashString(token);

    // Check if session exists and is active (lookup by hash)
    const session = await sessionRepository.findActiveByRefreshToken(tokenHash);

    if (!session) {
      // Token not found as current — check if it was already rotated out (reuse detection)
      const compromisedSession = await sessionRepository.detectTokenReuse(tokenHash);
      if (compromisedSession) {
        // Token replay detected! Revoke the entire token family
        this.log.warn('Refresh token reuse detected — revoking token family', {
          userId: payload.userId,
          sessionId: compromisedSession.id,
          tokenFamily: (compromisedSession as any).token_family,
        });
        const family = (compromisedSession as any).token_family;
        if (family) {
          await sessionRepository.revokeTokenFamily(family);
        } else {
          await sessionRepository.revoke(compromisedSession.id);
        }
      }
      throw new UnauthorizedError('Session expired or invalid');
    }

    // Get user
    const userResult = await userRepository.findWithDetails(payload.userId);

    if (!userResult) {
      throw new UnauthorizedError('User account is inactive');
    }

    const user = userResult as any;

    if (!user.is_active || user.is_blocked) {
      throw new UnauthorizedError('User account is inactive');
    }

    // Get hospital/doctor IDs (check hospitals, doctors, or staff for hospital association)
    const hospitalId = user.hospitals?.[0]?.id || user.doctors?.[0]?.hospital_id || user.staff?.[0]?.hospital_id;
    const doctorId = user.doctors?.[0]?.id;

    // Generate new tokens
    const tokenPayload: Omit<TokenPayload, 'iat' | 'exp' | 'iss'> = {
      userId: user.id,
      role: user.role,
      phone: user.phone,
      email: user.email,
      hospitalId,
      doctorId,
      sessionId: session.id,
      adminTier: user.admin_tier,
    };

    const tokens = generateTokenPair(tokenPayload);

    // Rotate: store old hash as previous, update to new hash
    await sessionRepository.update(session.id, {
      previous_refresh_token_hash: tokenHash,
      refresh_token_hash: hashString(tokens.refreshToken),
      last_used_at: new Date().toISOString(),
      device_id: deviceInfo?.deviceId || session.device_id,
      device_type: deviceInfo?.deviceType || session.device_type,
      device_name: deviceInfo?.deviceName || session.device_name,
      ip_address: ipAddress || session.ip_address,
      user_agent: userAgent || session.user_agent,
    } as any);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: parseDurationToSeconds(env.JWT_ACCESS_TOKEN_EXPIRES_IN),
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
    const user = await userRepository.findWithDetails(userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    return mapUserToProfile(user);
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, data: UpdateProfileInput): Promise<UserProfile> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    // Build update payload — only include fields that are provided
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (data.name !== undefined) updates.name = data.name;
    if (data.email !== undefined) updates.email = data.email;
    if (data.avatarUrl !== undefined) updates.avatar_url = data.avatarUrl;
    if (data.gender !== undefined) updates.gender = data.gender;
    if (data.dateOfBirth !== undefined) updates.date_of_birth = data.dateOfBirth;
    if (data.bloodGroup !== undefined) updates.blood_group = data.bloodGroup;
    if (data.address !== undefined) updates.address = data.address;
    if (data.emergencyContact !== undefined) updates.emergency_contact = data.emergencyContact;
    if (data.allergies !== undefined) updates.allergies = data.allergies;
    if (data.chronicConditions !== undefined) updates.medical_conditions = data.chronicConditions;

    const updatedUser = await userRepository.updateProfile(userId, updates as any);

    if (!updatedUser) {
      throw new BadRequestError('Failed to update profile');
    }

    const withDetails = await userRepository.findWithDetails(userId);
    return mapUserToProfile(withDetails);
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

