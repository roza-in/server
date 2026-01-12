import { AuthApiError } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '../../config/db.js';
import { env } from '../../config/env.js';
import { logger } from '../../common/logger.js';
import { generateTokenPair, TokenPayload } from '../../config/jwt.js';
import { BadRequestError, UnauthorizedError, UserNotFoundError, UserAlreadyExistsError } from '../../common/errors.js';
import type { LoginResponse, UserProfile } from './auth.types.js';
import type { UserRole } from '../../types/database.types.js';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

/**
 * Supabase OAuth Service
 * Handles Google OAuth flow using Supabase Auth
 * Flow: client -> /auth/google/url -> get redirect URL -> redirect to Google -> callback -> /auth/google/callback -> tokens
 */
export class SupabaseOAuthService {
  private supabase = getSupabaseAdmin();
  private logger = logger;

  // Session expiry in days
  private readonly SESSION_EXPIRES_DAYS = 30;
  private readonly SALT_ROUNDS = 10;

  /**
   * Generate Google OAuth redirect URL
   * Client will call this endpoint to get the redirect URL, then redirect user to Google login
   */
  async generateGoogleOAuthUrl(redirectUrl: string): Promise<{ url: string; state: string }> {
    // Generate state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');

    // Use Supabase's signInWithOAuth to get the proper OAuth URL
    // This requires Google OAuth to be configured in Supabase Dashboard
    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
        scopes: 'email profile',
      },
    });

    if (error || !data.url) {
      this.logger.error('Failed to generate Google OAuth URL', error);
      throw new BadRequestError('Failed to initiate Google OAuth. Please ensure Google OAuth is configured in Supabase Dashboard.');
    }

    this.logger.info('Generated Google OAuth URL', { state });
    return { url: data.url, state };
  }

  /**
   * Handle OAuth callback from Supabase Auth
   * Supabase returns code + state after user authenticates with Google
   * We exchange the code for a session and create ROZX tokens
   */
  async handleGoogleCallback(
    code: string,
    state: string,
    deviceInfo?: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginResponse> {
    try {
      // Exchange authorization code for session via Supabase Auth
      const { data: authData, error: authError } = await this.supabase.auth.exchangeCodeForSession(code);

      if (authError || !authData.session) {
        this.logger.error('Failed to exchange code for session', authError);
        throw new UnauthorizedError('Failed to authenticate with Google');
      }

      const { session, user: authUser } = authData;

      if (!authUser) {
        throw new UnauthorizedError('No user data from OAuth provider');
      }

      // Get or create user in our users table
      const email = authUser.email || authUser.user_metadata?.email;
      const fullName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || email?.split('@')[0] || 'User';
      const avatarUrl = authUser.user_metadata?.avatar_url || null;
      const googleId = authUser.id; // Supabase OAuth user ID

      if (!email) {
        throw new BadRequestError('Email is required for Google OAuth');
      }

      const phone = authUser.phone || authUser.user_metadata?.phone || authUser.user_metadata?.phone_number || null;
      return await this.processOAuthUser(email, fullName, avatarUrl, phone, googleId, deviceInfo, ipAddress, userAgent);
    } catch (error) {
      if (error instanceof AuthApiError) {
        this.logger.error('Supabase auth error', error);
        throw new UnauthorizedError('Authentication failed');
      }
      throw error;
    }
  }

  /**
   * Handle OAuth callback with Supabase session token
   * Alternative flow: client gets session from Supabase, sends access token to backend
   * We verify the token and create ROZX tokens
   */
  async handleGoogleCallbackWithToken(
    accessToken: string,
    userId: string,
    deviceInfo?: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginResponse> {
    try {
      // Get user from Supabase auth using the access token
      const { data: { user: authUser }, error: userError } = await this.supabase.auth.getUser(accessToken);

      if (userError || !authUser) {
        this.logger.error('Failed to get user from access token', userError);
        throw new UnauthorizedError('Invalid access token');
      }

      // Verify userId matches
      if (authUser.id !== userId) {
        throw new UnauthorizedError('User ID mismatch');
      }

      // Get or create user in our users table
      const email = authUser.email || authUser.user_metadata?.email;
      const fullName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || email?.split('@')[0] || 'User';
      const avatarUrl = authUser.user_metadata?.avatar_url || null;
      const phone = authUser.phone || authUser.user_metadata?.phone || authUser.user_metadata?.phone_number || null;
      const googleId = authUser.id; // Supabase OAuth user ID

      if (!email) {
        throw new BadRequestError('Email is required for Google OAuth');
      }

      return await this.processOAuthUser(email, fullName, avatarUrl, phone, googleId, deviceInfo, ipAddress, userAgent);
    } catch (error) {
      if (error instanceof AuthApiError) {
        this.logger.error('Supabase auth error', error);
        throw new UnauthorizedError('Authentication failed');
      }
      throw error;
    }
  }

  /**
   * Complete OAuth flow when client provides Supabase access token, userId and phone
   * Ensures the user's phone is set & verified, and returns ROZX tokens
   */
  async completeGoogleCallbackWithToken(
    accessToken: string,
    userId: string,
    phone: string,
    deviceInfo?: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginResponse> {
    try {
      // Get user from Supabase auth using the access token
      const { data: { user: authUser }, error: userError } = await this.supabase.auth.getUser(accessToken);

      if (userError || !authUser) {
        this.logger.error('Failed to get user from access token', userError);
        throw new UnauthorizedError('Invalid access token');
      }

      // Verify userId matches
      if (authUser.id !== userId) {
        throw new UnauthorizedError('User ID mismatch');
      }

      const email = authUser.email || authUser.user_metadata?.email;
      const fullName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || email?.split('@')[0] || 'User';
      const avatarUrl = authUser.user_metadata?.avatar_url || null;
      const googleId = authUser.id; // Supabase OAuth user ID

      if (!email) {
        throw new BadRequestError('Email is required for Google OAuth');
      }

      // Before proceeding, ensure phone is provided
      if (!phone) {
        throw new BadRequestError('Phone number is required to complete registration');
      }

      // If another account already uses this phone, prevent takeover
      const { data: phoneOwner } = await this.supabase
        .from('users')
        .select('id')
        .eq('phone', phone)
        .single();

      if (phoneOwner && phoneOwner.id !== undefined && phoneOwner.id !== null && phoneOwner.id !== authUser.id) {
        throw new BadRequestError('Phone number already in use');
      }

      // Use shared logic to get/create the user and create session/tokens
      const result = await this.processOAuthUser(email, fullName, avatarUrl, phone, googleId, deviceInfo, ipAddress, userAgent);

      // Ensure user's phone is set and verified in our users table
      await this.supabase.from('users').update({ phone, phone_verified: true, phone_verified_at: new Date().toISOString() }).eq('email', email);

      return result;
    } catch (error) {
      if (error instanceof AuthApiError) {
        this.logger.error('Supabase auth error', error);
        throw new UnauthorizedError('Authentication failed');
      }
      throw error;
    }
  }

  /**
   * Process OAuth user - get or create user and generate ROZX tokens
   * Shared logic between different OAuth flows
   */
  private async processOAuthUser(
    email: string,
    fullName: string,
    avatarUrl: string | null,
    phone: string | null,
    googleId: string,
    deviceInfo?: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginResponse> {

    // Check if user already exists by email
    let { data: existingUser, error: existingError } = await this.supabase
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

      if (existingError?.code === 'PGRST116') {
      // User doesn't exist, create new user
        // Generate and store a random password hash to satisfy DB not-null constraint
        const randomPassword = crypto.randomBytes(24).toString('hex');
        const passwordHash = await bcrypt.hash(randomPassword, this.SALT_ROUNDS);

        const { data: newUserData, error: createError } = await this.supabase
          .from('users')
          .insert({
            phone: phone || '',
            email,
            full_name: fullName,
            google_id: googleId,
            avatar_url: avatarUrl,
            role: 'patient' as UserRole,
            email_verified: true,
            email_verified_at: new Date().toISOString(),
            phone_verified: phone ? true : false,
            phone_verified_at: phone ? new Date().toISOString() : null,
            is_active: true,
            is_blocked: false,
            last_login_at: new Date().toISOString(),
            password_hash: passwordHash,
          })
          .select()
          .single();

      if (createError || !newUserData) {
        this.logger.error('Failed to create user from Google OAuth', createError);
        throw new BadRequestError('Failed to create account');
      }

      user = newUserData as any;
      isNewUser = true;

      // Note: patient_credits are created automatically by database trigger
      // when a patient user is inserted

      // Note: notification_preferences are created automatically by database trigger
      // when a user is inserted

      this.logger.info('Created new user from Google OAuth', { userId: user.id, email });
    } else if (existingError) {
      this.logger.error('Failed to find user', existingError);
      throw new BadRequestError('Failed to process user account');
    } else {
      // Update existing user
      const updates: any = {
        last_login_at: new Date().toISOString(),
      };

      // Update google_id if not already set
      if (!user.google_id && googleId) {
        updates.google_id = googleId;
      }

      // Update avatar if provided and user doesn't have one
      if (!user.avatar_url && avatarUrl) {
        updates.avatar_url = avatarUrl;
      }

      if (Object.keys(updates).length > 0) {
        await this.supabase.from('users').update(updates).eq('id', user.id);
        user = { ...user, ...updates };
      }

      this.logger.info('User logged in via Google OAuth', { userId: user.id, email });
    }

    // Check user status
    if (user.is_blocked) {
      throw new UnauthorizedError(`Account blocked: ${user.blocked_reason || 'Contact support'}`);
    }

    if (!user.is_active) {
      throw new UnauthorizedError('Account is inactive');
    }

    // Extract hospital/doctor info
    const doctors = user.doctors as any[];
    const hospitals = user.hospitals as any[];
    const hospitalId = hospitals?.[0]?.id || doctors?.[0]?.hospital_id;
    const doctorId = doctors?.[0]?.id;

    // Generate ROZX tokens (JWT pair)
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

    // Create session record in our database
    await this.createSession(user.id, sessionId, tokens.refreshToken, deviceInfo, ipAddress, userAgent);

    return {
      user: this.formatUserProfile(user, hospitalId, doctorId),
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: 3600, // 1 hour
      },
      isNewUser,
    };
  }

  /**
   * Create user session record in database
   */
  private async createSession(
    userId: string,
    sessionId: string,
    refreshToken: string,
    deviceInfo?: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + this.SESSION_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

    const { error } = await this.supabase.from('user_sessions').insert({
      id: sessionId,
      user_id: userId,
      refresh_token: refreshToken,
      device_info: deviceInfo || null,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      expires_at: expiresAt.toISOString(),
      is_active: true,
      last_active_at: new Date().toISOString(),
    });

    if (error) {
      this.logger.error('Failed to create session', error);
      throw new BadRequestError('Failed to create session');
    }
  }

  /**
   * Format user profile for response
   */
  private formatUserProfile(user: any, hospitalId?: string, doctorId?: string): UserProfile {
    const doctors = user.doctors as any[];
    const hospitals = user.hospitals as any[];
    const doctor = doctors?.[0] || null;
    const hospital = hospitals?.[0] || null;

    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      fullName: user.full_name,
      avatarUrl: user.avatar_url,
      // Provide both snake_case and camelCase keys for frontend compatibility
      profile_picture_url: user.avatar_url,
      profilePictureUrl: user.avatar_url,
      role: user.role,
      isActive: user.is_active,
      isBlocked: user.is_blocked,
      phoneVerified: user.phone_verified,
      emailVerified: user.email_verified,
      lastLoginAt: user.last_login_at,
      createdAt: user.created_at,
      doctor,
      hospital,
      ...(hospitalId && { hospitalId }),
      ...(doctorId && { doctorId }),
    } as UserProfile;
  }
}

// Export singleton instance
export const supabaseOAuthService = new SupabaseOAuthService();
