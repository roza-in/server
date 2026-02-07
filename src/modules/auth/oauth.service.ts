import { AuthApiError } from '@supabase/supabase-js';
import { supabaseAdmin as supabase } from '../../database/supabase-admin.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { generateTokenPair } from '../../common/utils/jwt.js';
import type { TokenPayload } from '../../types/jwt.js';
import { BadRequestError, UnauthorizedError, UserNotFoundError } from '../../common/errors/index.js';
import type { LoginResponse } from './auth.types.js';
import type { UserRole } from '../../types/database.types.js';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { userRepository } from '../../database/repositories/user.repo.js';
import { authService } from './auth.service.js';
import { formatUserProfile } from '../users/user.mapper.js';

/**
 * Supabase OAuth Service
 * Handles Google OAuth flow using Supabase Auth
 * Flow: client -> /auth/google/url -> get redirect URL -> redirect to Google -> callback -> /auth/google/callback -> tokens
 */
export class SupabaseOAuthService {
  private supabase = supabase;
  private log = logger.child('SupabaseOAuthService');

  // Session expiry defaults (aligned with AuthService)
  private readonly SALT_ROUNDS = 10;

  /**
   * Generate Google OAuth redirect URL
   */
  async generateGoogleOAuthUrl(redirectUrl: string): Promise<{ url: string; state: string }> {
    const state = crypto.randomBytes(32).toString('hex');
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
      this.log.error('Failed to generate Google OAuth URL', error);
      throw new BadRequestError('Failed to initiate Google OAuth. Please ensure Google OAuth is configured in Supabase Dashboard.');
    }

    this.log.info('Generated Google OAuth URL', { state });
    return { url: data.url, state };
  }

  /**
   * Handle OAuth callback from Supabase Auth
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
        this.log.error('Failed to exchange code for session', authError);
        throw new UnauthorizedError('Failed to authenticate with Google');
      }

      const { user: authUser } = authData;

      if (!authUser) {
        throw new UnauthorizedError('No user data from OAuth provider');
      }

      // Get or create user in our users table
      const email = authUser.email || authUser.user_metadata?.email;
      const name = authUser.user_metadata?.name || authUser.user_metadata?.name || email?.split('@')[0] || 'User';
      const avatarUrl = authUser.user_metadata?.avatar_url || null;

      if (!email) {
        throw new BadRequestError('Email is required for Google OAuth');
      }

      const phone = authUser.phone || authUser.user_metadata?.phone || authUser.user_metadata?.phone_number || null;
      return await this.processOAuthUser(email, name, avatarUrl, phone, deviceInfo, ipAddress, userAgent);
    } catch (error) {
      if (error instanceof AuthApiError) {
        this.log.error('Supabase auth error', error);
        throw new UnauthorizedError('Authentication failed');
      }
      throw error;
    }
  }

  /**
   * Handle OAuth callback with Supabase session token
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
        this.log.error('Failed to get user from access token', userError);
        throw new UnauthorizedError('Invalid access token');
      }

      // Verify userId matches
      if (authUser.id !== userId) {
        throw new UnauthorizedError('User ID mismatch');
      }

      // Get or create user in our users table
      const email = authUser.email || authUser.user_metadata?.email;
      const name = authUser.user_metadata?.name || authUser.user_metadata?.name || email?.split('@')[0] || 'User';
      const avatarUrl = authUser.user_metadata?.avatar_url || null;
      const phone = authUser.phone || authUser.user_metadata?.phone || authUser.user_metadata?.phone_number || null;

      if (!email) {
        throw new BadRequestError('Email is required for Google OAuth');
      }

      return await this.processOAuthUser(email, name, avatarUrl, phone, deviceInfo, ipAddress, userAgent);
    } catch (error) {
      if (error instanceof AuthApiError) {
        this.log.error('Supabase auth error', error);
        throw new UnauthorizedError('Authentication failed');
      }
      throw error;
    }
  }

  /**
   * Complete OAuth flow when client provides Supabase access token, userId and phone
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
        this.log.error('Failed to get user from access token', userError);
        throw new UnauthorizedError('Invalid access token');
      }

      // Verify userId matches
      if (authUser.id !== userId) {
        throw new UnauthorizedError('User ID mismatch');
      }

      const email = authUser.email || authUser.user_metadata?.email;
      const name = authUser.user_metadata?.name || authUser.user_metadata?.name || email?.split('@')[0] || 'User';
      const avatarUrl = authUser.user_metadata?.avatar_url || null;

      if (!email) {
        throw new BadRequestError('Email is required for Google OAuth');
      }

      if (!phone) {
        throw new BadRequestError('Phone number is required to complete registration');
      }

      // If another account already uses this phone, prevent takeover
      const phoneOwner = await userRepository.findByPhone(phone);

      if (phoneOwner && phoneOwner.id !== authUser.id) {
        throw new BadRequestError('Phone number already in use');
      }

      // Use shared logic to get/create the user and create session/tokens
      const result = await this.processOAuthUser(email, name, avatarUrl, phone, deviceInfo, ipAddress, userAgent);

      // Ensure user's phone is set and verified in our users table
      await userRepository.update(result.user.id, {
        phone,
        phone_verified: true,
      });

      return result;
    } catch (error) {
      if (error instanceof AuthApiError) {
        this.log.error('Supabase auth error', error);
        throw new UnauthorizedError('Authentication failed');
      }
      throw error;
    }
  }

  /**
   * Process OAuth user - get or create user and generate ROZX tokens
   */
  private async processOAuthUser(
    email: string,
    name: string,
    avatarUrl: string | null,
    phone: string | null,
    deviceInfo?: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginResponse> {

    // Check if user already exists by email
    const userResult = await userRepository.findWithDetails(email);
    let user = userResult as any;
    let isNewUser = false;

    if (!user) {
      // User doesn't exist, create new user
      const randomPassword = crypto.randomBytes(24).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, this.SALT_ROUNDS);

      this.log.info('Creating new OAuth user', { email, phone });

      const newUserData = await userRepository.create({
        phone: phone || null,
        email,
        name: name,
        avatar_url: avatarUrl,
        role: 'patient' as UserRole,
        email_verified: true,
        phone_verified: phone ? true : false,
        is_active: true,
        is_blocked: false,
        last_login_at: new Date().toISOString(),
        password_hash: passwordHash,
      } as any);

      if (!newUserData) {
        this.log.error('Failed to create user from Google OAuth', { email });
        throw new BadRequestError('Failed to create account');
      }

      user = { ...newUserData, doctors: [], hospitals: [] };
      isNewUser = true;
      this.log.info('Created new user from Google OAuth', { userId: user.id, email });
    } else {
      // Update existing user
      const updates: any = {
        last_login_at: new Date().toISOString(),
      };

      if (!user.avatar_url && avatarUrl) {
        updates.avatar_url = avatarUrl;
      }

      if (Object.keys(updates).length > 0) {
        await userRepository.update(user.id, updates);
        user = { ...user, ...updates };
      }

      this.log.info('User logged in via Google OAuth', { userId: user.id, email });
    }

    // Check user status
    if (user.is_blocked) {
      throw new UnauthorizedError(`Account blocked: ${user.blocked_reason || 'Contact support'}`);
    }

    if (!user.is_active) {
      throw new UnauthorizedError('Account is inactive');
    }

    // Extract hospital/doctor info
    const hospitalId = user.hospitals?.[0]?.id || user.doctors?.[0]?.hospital_id;
    const doctorId = user.doctors?.[0]?.id;

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
    await authService.createSession(user.id, tokens.refreshToken, sessionId, deviceInfo, ipAddress, userAgent);

    return {
      user: formatUserProfile(user, hospitalId, doctorId),
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: 3600, // 1 hour
      },
      isNewUser,
    };
  }
}

// Export singleton instance
export const supabaseOAuthService = new SupabaseOAuthService();

