import { Request, Response } from 'express';
import { authService } from './auth.service.js';
import { supabaseOAuthService } from './oauth.service.js';
import { sendSuccess, sendCreated } from '../../common/response.js';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import type { AuthenticatedRequest } from '../../types/request.js';
import type {
  SendOTPInput,
  VerifyOTPInput,
  RegisterPatientInput,
  RegisterHospitalInput,
  LoginWithPasswordInput,
  GoogleOAuthInput,
  RefreshTokenInput,
  UpdateProfileInput,
} from './auth.validator.js';
import { isProduction } from '../../config/env.js';
import { clearTokenCookies, setTokenCookies } from '@/utils/token-cookies.js';

/**
 * Auth Controller - Production-ready authentication endpoints
 */

// ============================================================================
// OTP Authentication (SMS/Email)
// ============================================================================

/**
 * Send OTP for authentication
 * POST /api/v1/auth/otp/send
 * Body: { phone?: string, email?: string, purpose: 'login'|'registration'|..., channel?: 'sms'|'email' }
 */
export const sendOTP = asyncHandler(async (req: Request, res: Response) => {
  const data: SendOTPInput = req.body;
  const result = await authService.sendOTP(data);
  return sendSuccess(res, result, 'OTP sent successfully');
});

/**
 * Verify OTP and login
 * POST /api/v1/auth/otp/verify
 */
export const verifyOTP = asyncHandler(async (req: Request, res: Response) => {
  const data: VerifyOTPInput = req.body;

  const deviceInfo = extractDeviceInfo(req);
  const ipAddress = extractIPAddress(req);
  const userAgent = req.get('user-agent');
  
  const result = await authService.loginWithOTP(data, deviceInfo, ipAddress, userAgent);
  // Set HttpOnly cookies for access and refresh tokens
  try {
    const expiresIn = result.tokens?.expiresIn ?? 3600; 
    setTokenCookies(res, result.tokens?.accessToken || '', result.tokens?.refreshToken || '', { maxAgeSeconds: expiresIn, secure: isProduction, sameSite: 'lax' });
  } catch (err) {
    // ignore cookie failures
  }

  return sendSuccess(res, result, 'Login successful');
});

/**
 * Login with email/password
 * POST /api/v1/auth/login/password
 */
export const loginWithPassword = asyncHandler(async (req: Request, res: Response) => {
  const data: LoginWithPasswordInput = req.body;

  const deviceInfo = extractDeviceInfo(req);
  const ipAddress = extractIPAddress(req);
  const userAgent = req.get('user-agent');

  const result = await authService.loginWithPassword(data, deviceInfo, ipAddress, userAgent);
  try {
    const expiresIn = result.tokens?.expiresIn ?? 3600;
    setTokenCookies(res, result.tokens?.accessToken || '', result.tokens?.refreshToken || '', { maxAgeSeconds: expiresIn, secure: isProduction, sameSite: 'lax' });
  } catch (err) {}

  return sendSuccess(res, result, 'Login successful');
});

// ============================================================================
// User Registration
// ============================================================================

/**
 * Register a new patient
 * POST /api/v1/auth/register/patient
 */
export const registerPatient = asyncHandler(async (req: Request, res: Response) => {
  const data: RegisterPatientInput = req.body;
  const deviceInfo = extractDeviceInfo(req);
  const ipAddress = extractIPAddress(req);
  const userAgent = req.get('user-agent');
  
  const result = await authService.registerPatient(data, deviceInfo, ipAddress, userAgent);
  try {
    const expiresIn = result.tokens?.expiresIn ?? 3600;
    setTokenCookies(res, result.tokens?.accessToken || '', result.tokens?.refreshToken || '', { maxAgeSeconds: expiresIn, secure: isProduction, sameSite: 'lax' });
  } catch (err) {}

  return sendCreated(res, result, 'Account created successfully');
});

/**
 * Register a new hospital
 * POST /api/v1/auth/register/hospital
 */
export const registerHospital = asyncHandler(async (req: Request, res: Response) => {
  const data: RegisterHospitalInput = req.body;
  const deviceInfo = extractDeviceInfo(req);
  const ipAddress = extractIPAddress(req);
  const userAgent = req.get('user-agent');
  
  const result = await authService.registerHospital(data, deviceInfo, ipAddress, userAgent);
  try {
    const expiresIn = result.tokens?.expiresIn ?? 3600;
    setTokenCookies(res, result.tokens?.accessToken || '', result.tokens?.refreshToken || '', { maxAgeSeconds: expiresIn, secure: isProduction, sameSite: 'lax' });
  } catch (err) {}

  return sendCreated(res, result, 'Hospital registered successfully');
});

// ============================================================================
// Google OAuth
// ============================================================================

/**
 * Google OAuth login/register (DEPRECATED - use Supabase Auth flow)
 * POST /api/v1/auth/google
 * @deprecated Use GET /auth/google/url + POST /auth/google/callback instead
 */
export const googleOAuth = asyncHandler(async (req: Request, res: Response) => {
  const { idToken } = req.body as GoogleOAuthInput;
  const deviceInfo = extractDeviceInfo(req);
  const ipAddress = extractIPAddress(req);
  const userAgent = req.get('user-agent');
  
  const result = await authService.googleOAuth(idToken, deviceInfo, ipAddress, userAgent);
  return sendSuccess(res, result, 'Login successful');
});

/**
 * Get Google OAuth redirect URL (Supabase Auth flow)
 * GET /api/v1/auth/google/url?redirectUrl=http://localhost:3000/auth/callback
 * Returns: { url: string, state: string }
 */
export const getGoogleOAuthUrl = asyncHandler(async (req: Request, res: Response) => {
  const { redirectUrl } = req.query as { redirectUrl?: string };

  if (!redirectUrl) {
    return res.status(400).json({
      success: false,
      error: { message: 'redirectUrl query parameter is required' },
    });
  }

  const { url, state } = await supabaseOAuthService.generateGoogleOAuthUrl(redirectUrl as string);

  return sendSuccess(res, { url, state }, 'OAuth URL generated');
});

/**
 * Handle Google OAuth callback from Supabase Auth
 * POST /api/v1/auth/google/callback
 * Body: { accessToken: string, userId: string }
 * Returns: { user, tokens, isNewUser }
 */
export const handleGoogleCallback = asyncHandler(async (req: Request, res: Response) => {
  const { accessToken, userId } = req.body as { accessToken?: string; userId?: string };

  if (!accessToken || !userId) {
    return res.status(400).json({
      success: false,
      error: { message: 'Supabase access token and user ID are required' },
    });
  }

  const deviceInfo = extractDeviceInfo(req);
  const ipAddress = extractIPAddress(req);
  const userAgent = req.get('user-agent');

  const result = await supabaseOAuthService.handleGoogleCallbackWithToken(accessToken, userId, deviceInfo, ipAddress, userAgent);
  try {
      const expiresIn = result.tokens?.expiresIn ?? 3600;
      setTokenCookies(res, result.tokens?.accessToken || '', result.tokens?.refreshToken || '', { maxAgeSeconds: expiresIn, secure: isProduction, sameSite: 'lax' });
  } catch (err) {}

  return sendSuccess(res, result, 'Login successful');
});

/**
 * Complete Google OAuth registration with phone
 * POST /api/v1/auth/google/complete
 * Body: { accessToken: string, userId: string, phone: string }
 */
export const completeGoogleCallback = asyncHandler(async (req: Request, res: Response) => {
  const { accessToken, userId, phone } = req.body as { accessToken?: string; userId?: string; phone?: string };

  if (!accessToken || !userId || !phone) {
    return res.status(400).json({ success: false, error: { message: 'accessToken, userId and phone are required' } });
  }

  const deviceInfo = extractDeviceInfo(req);
  const ipAddress = extractIPAddress(req);
  const userAgent = req.get('user-agent');

  const result = await supabaseOAuthService.completeGoogleCallbackWithToken(accessToken, userId, phone, deviceInfo, ipAddress, userAgent);
  try {
    const expiresIn = result.tokens?.expiresIn ?? 3600;
    setTokenCookies(res, result.tokens?.accessToken || '', result.tokens?.refreshToken || '', { maxAgeSeconds: expiresIn, secure: isProduction, sameSite: 'lax' });
  } catch (err) {}

  return sendSuccess(res, result, 'Login successful');
});

// ============================================================================
// Token Management
// ============================================================================

/**
 * Refresh access token
 * POST /api/v1/auth/refresh
 */
export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const data: RefreshTokenInput = req.body;
  const deviceInfo = extractDeviceInfo(req);
  const ipAddress = extractIPAddress(req);
  const userAgent = req.get('user-agent');
  
  const result = await authService.refreshAccessToken(data, deviceInfo, ipAddress, userAgent);
  return sendSuccess(res, result, 'Token refreshed successfully');
});

/**
 * Logout - revoke current session
 * POST /api/v1/auth/logout
 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const sessionId = authReq.user?.sessionId;
  
  if (sessionId) {
    await authService.logout(sessionId);
  }
  // Clear auth cookies
  try {
    clearTokenCookies(res);
  } catch (e) {}

  return sendSuccess(res, null, 'Logged out successfully');
});

/**
 * Logout from all devices - revoke all sessions
 * POST /api/v1/auth/logout/all
 */
export const logoutAll = asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.userId;
  
  if (userId) {
    await authService.logoutAll(userId);
  }
  
  return sendSuccess(res, null, 'Logged out from all devices successfully');
});

// ============================================================================
// Profile Management
// ============================================================================

/**
 * Get current user profile
 * GET /api/v1/auth/me
 */
export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.userId;
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: { message: 'Unauthorized' },
    });
  }
  
  const profile = await authService.getProfile(userId);
  return sendSuccess(res, profile);
});

/**
 * Update user profile
 * PUT /api/v1/auth/profile
 */
export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.userId;
  const data: UpdateProfileInput = req.body;
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: { message: 'Unauthorized' },
    });
  }
  
  // Update profile logic would go here
  // For now, just return success
  return sendSuccess(res, null, 'Profile updated successfully');
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract device info from request
 */
function extractDeviceInfo(req: Request): any {
  const userAgent = req.get('user-agent') || '';
  const deviceId = req.get('x-device-id');
  const deviceName = req.get('x-device-name');
  const deviceType = req.get('x-device-type');
  
  return {
    deviceId,
    deviceName,
    deviceType,
    userAgent,
    os: extractOS(userAgent),
    browser: extractBrowser(userAgent),
  };
}

/**
 * Extract IP address from request
 */
function extractIPAddress(req: Request): string {
  return (
    (req.get('x-forwarded-for') || '').split(',')[0] ||
    req.get('x-real-ip') ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

/**
 * Extract OS from user agent
 */
function extractOS(userAgent: string): string {
  if (/windows/i.test(userAgent)) return 'Windows';
  if (/macintosh|mac os x/i.test(userAgent)) return 'MacOS';
  if (/linux/i.test(userAgent)) return 'Linux';
  if (/android/i.test(userAgent)) return 'Android';
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'iOS';
  return 'Unknown';
}

/**
 * Extract browser from user agent
 */
function extractBrowser(userAgent: string): string {
  if (/chrome/i.test(userAgent) && !/edge/i.test(userAgent)) return 'Chrome';
  if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) return 'Safari';
  if (/firefox/i.test(userAgent)) return 'Firefox';
  if (/edge/i.test(userAgent)) return 'Edge';
  if (/opera/i.test(userAgent)) return 'Opera';
  return 'Unknown';
}
