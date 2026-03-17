import { AuthApiError } from '@supabase/supabase-js';
import { supabaseAdmin as supabase } from '../../database/supabase-admin.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { generateTokenPair } from '../../common/utils/jwt.js';
import { parseDurationToSeconds } from '../../common/utils/date.js';
import type { TokenPayload } from '../../types/jwt.js';
import { BadRequestError, UnauthorizedError, UserNotFoundError } from '../../common/errors/index.js';
import type { LoginResponse } from './auth.types.js';
import type { UserRole } from '../../types/database.types.js';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { userRepository } from '../../database/repositories/user.repo.js';
import { authService } from './auth.service.js';
import { formatUserProfile } from '../users/user.mapper.js';

// =============================================================================
// PKCE Helpers — manual implementation (bypasses Supabase JS client's broken
// storage that silently ignores custom adapters when persistSession=false)
// =============================================================================

/** Generate a cryptographically random PKCE code_verifier (RFC 7636) */
function generatePKCEVerifier(): string {
  // 32 random bytes → 43 base64url chars (meets RFC 7636 minimum of 43)
  return crypto.randomBytes(32).toString('base64url');
}

/** Derive the S256 code_challenge from a code_verifier */
function generatePKCEChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// =============================================================================
// In-memory PKCE store — maps state → code_verifier
// =============================================================================

interface PkceEntry {
  codeVerifier: string;
  timer: ReturnType<typeof setTimeout>;
}

const pkceStore = new Map<string, PkceEntry>();

/** How long a PKCE verifier is kept before auto-cleanup (10 min) */
const PKCE_TTL_MS = 10 * 60 * 1000;

/**
 * Supabase OAuth Service
 * Handles Google OAuth flow using Supabase Auth
 * Flow: client -> /auth/google/url -> get redirect URL -> redirect to Google -> callback -> /auth/google/callback -> tokens
 */
export class SupabaseOAuthService {
  private supabase = supabase;
  private log = logger.child('SupabaseOAuthService');

  // Session expiry defaults (aligned with AuthService)
  private readonly SALT_ROUNDS = 12; // S3: increased from 10 for stronger password hashing

  /**
   * Generate Google OAuth redirect URL
   *
   * Uses manual PKCE: we generate code_verifier/code_challenge ourselves and
   * construct the Supabase /authorize URL directly. This avoids the Supabase JS
   * client's broken storage (ignores custom adapters when persistSession=false).
   */
  async generateGoogleOAuthUrl(redirectUrl: string): Promise<{ url: string; state: string }> {
    const state = crypto.randomBytes(32).toString('hex');
    const codeVerifier = generatePKCEVerifier();
    const codeChallenge = generatePKCEChallenge(codeVerifier);

    // Embed our custom state in the redirect URL so it survives the
    // Google → Supabase → app redirect chain.
    const separator = redirectUrl.includes('?') ? '&' : '?';
    const redirectWithState = `${redirectUrl}${separator}rozx_state=${state}`;

    // Construct Supabase OAuth authorize URL directly
    const authorizeUrl = new URL(`${env.SUPABASE_URL}/auth/v1/authorize`);
    authorizeUrl.searchParams.set('provider', 'google');
    authorizeUrl.searchParams.set('redirect_to', redirectWithState);
    authorizeUrl.searchParams.set('scopes', 'email profile');
    authorizeUrl.searchParams.set('code_challenge', codeChallenge);
    authorizeUrl.searchParams.set('code_challenge_method', 's256');
    authorizeUrl.searchParams.set('access_type', 'offline');
    authorizeUrl.searchParams.set('prompt', 'consent');

    // Store verifier for the callback exchange
    const timer = setTimeout(() => pkceStore.delete(state), PKCE_TTL_MS);
    pkceStore.set(state, { codeVerifier, timer });

    this.log.info('Generated Google OAuth URL', { state, redirectTo: redirectWithState });
    return { url: authorizeUrl.toString(), state };
  }

  /**
   * Handle OAuth callback from Supabase Auth
   *
   * Exchanges the authorization code for a Supabase session by calling the
   * Supabase REST API directly with our stored code_verifier. This bypasses
   * the JS client entirely, avoiding the persistSession storage bug.
   */
  async handleGoogleCallback(
    code: string,
    state: string,
    deviceInfo?: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginResponse> {
    try {
      this.log.info('Processing Google OAuth callback', { codeLength: code?.length, state: state || '(none)' });

      // Resolve the code_verifier for this flow
      let codeVerifier: string | undefined;
      const stored = state ? pkceStore.get(state) : undefined;
      if (stored) {
        clearTimeout(stored.timer);
        pkceStore.delete(state);
        codeVerifier = stored.codeVerifier;
        this.log.info('Found PKCE verifier for state', { state });
      } else if (pkceStore.size === 1) {
        // Dev fallback: if there's exactly 1 PKCE entry, use it.
        const [fallbackState, fallbackEntry] = [...pkceStore.entries()][0];
        clearTimeout(fallbackEntry.timer);
        pkceStore.delete(fallbackState);
        codeVerifier = fallbackEntry.codeVerifier;
        this.log.info('Dev fallback: using the only PKCE entry', { originalState: fallbackState, requestedState: state });
      }

      if (!codeVerifier) {
        this.log.error('No PKCE code_verifier available', { state, pkceStoreSize: pkceStore.size });
        throw new UnauthorizedError('OAuth session expired. Please try logging in again.');
      }

      // Exchange code via Supabase REST API (bypasses JS client storage issues)
      const tokenResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=pkce`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': env.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          auth_code: code,
          code_verifier: codeVerifier,
        }),
      });

      if (!tokenResponse.ok) {
        const errBody = await tokenResponse.json().catch(() => ({}));
        this.log.error('Supabase token exchange failed', { status: tokenResponse.status, error: errBody });
        throw new UnauthorizedError('Failed to authenticate with Google');
      }

      const sessionData: Record<string, any> = await tokenResponse.json();
      // sessionData: { access_token, token_type, expires_in, expires_at, refresh_token, user }

      const authUser = sessionData.user;
      if (!authUser) {
        throw new UnauthorizedError('No user data from OAuth provider');
      }

      // S4: Verify the user authenticated via Google (not another provider)
      this.verifyGoogleProvider(authUser);

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
      if (error instanceof UnauthorizedError || error instanceof BadRequestError) throw error;
      this.log.error('OAuth callback error', error);
      throw new UnauthorizedError('Authentication failed');
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

      // S4: Verify the user authenticated via Google (not another provider)
      this.verifyGoogleProvider(authUser);

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

      // S4: Verify the user authenticated via Google (not another provider)
      this.verifyGoogleProvider(authUser);

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
      // Update existing user — increment login_count
      const updates: any = {
        last_login_at: new Date().toISOString(),
        login_count: (user.login_count || 0) + 1,
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

    // Extract hospital/doctor info (check hospitals, doctors, or staff)
    const hospitalId = user.hospitals?.[0]?.id || user.doctors?.[0]?.hospital_id || user.staff?.[0]?.hospital_id;
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
        expiresIn: parseDurationToSeconds(env.JWT_ACCESS_TOKEN_EXPIRES_IN),
      },
      isNewUser,
    };
  }

  // =================================================================
  // S4: Provider Verification
  // =================================================================

  /**
   * Verify that the Supabase auth user authenticated via the Google provider.
   * Prevents token confusion attacks where a token from a different auth
   * provider is presented to the Google OAuth callback endpoint.
   *
   * Also validates the `aud` claim (Supabase project ref) if present, and
   * checks that email is confirmed by the identity provider.
   */
  private verifyGoogleProvider(authUser: { app_metadata?: Record<string, any>; user_metadata?: Record<string, any>; identities?: Array<{ provider?: string; identity_data?: Record<string, any> }> }): void {
    const provider = authUser.app_metadata?.provider;
    const providers = authUser.app_metadata?.providers as string[] | undefined;

    // Primary check: the last-used provider must be google
    if (provider !== 'google') {
      this.log.warn('OAuth provider mismatch', { expected: 'google', actual: provider });
      throw new UnauthorizedError('Authentication must use Google OAuth');
    }

    // Secondary check: google must be in the list of linked providers
    if (providers && !providers.includes('google')) {
      this.log.warn('Google not in linked providers', { providers });
      throw new UnauthorizedError('Google identity not linked to this account');
    }

    // Verify email is confirmed by the identity provider
    const googleIdentity = authUser.identities?.find((id) => id.provider === 'google');
    if (googleIdentity) {
      const emailVerified = googleIdentity.identity_data?.email_verified;
      if (emailVerified === false) {
        this.log.warn('Google email not verified', { identity: googleIdentity.identity_data?.email });
        throw new UnauthorizedError('Google account email is not verified');
      }
    }

    // Validate aud claim matches GOOGLE_CLIENT_ID (if configured)
    const audClaim = authUser.user_metadata?.aud || googleIdentity?.identity_data?.aud;
    if (env.GOOGLE_CLIENT_ID && audClaim && audClaim !== env.GOOGLE_CLIENT_ID) {
      this.log.warn('Google aud claim mismatch', { expected: env.GOOGLE_CLIENT_ID, actual: audClaim });
      throw new UnauthorizedError('OAuth audience mismatch');
    }
  }
}

// Export singleton instance
export const supabaseOAuthService = new SupabaseOAuthService();

