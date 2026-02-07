import { Request, Response } from 'express';
import { sendSuccess, sendCreated } from '../../common/responses/index.js';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import { authService } from './auth.service.js';
import { supabaseOAuthService } from './oauth.service.js';
import { setTokenCookies, getTokensFromReq, clearTokenCookies } from '../../common/utils/cookies.js';
import { env } from '../../config/env.js';

/**
 * Auth Controller - Production-ready authentication handlers
 * Security: Tokens are strictly handled via HttpOnly cookies and omitted from JSON responses.
 */
class AuthController {
  /**
   * Send OTP to phone or email
   */
  sendOTP = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.sendOTP(req.body);
    return sendSuccess(res, result, 'OTP sent successfully');
  });

  /**
   * Validate registration OTP (without consuming it)
   */
  validateRegistrationOTP = asyncHandler(async (req: Request, res: Response) => {
    const { phone, otp } = req.body;
    const result = await authService.validateRegistrationOTP(phone, otp);
    return sendSuccess(res, result, 'OTP is valid');
  });

  /**
   * Login/Verify OTP
   */
  loginWithOTP = asyncHandler(async (req: Request, res: Response) => {
    const deviceInfo = req.body.deviceInfo || {};
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];

    const result = await authService.loginWithOTP(req.body, deviceInfo, ipAddress, userAgent);

    // Set HttpOnly cookies
    setTokenCookies(res, result.tokens.accessToken, result.tokens.refreshToken, { maxAgeSeconds: result.tokens.expiresIn });

    // Omit tokens from response body
    const { tokens, ...publicData } = result;
    return sendSuccess(res, publicData, 'Login successful');
  });

  /**
   * Login with email + password
   */
  loginWithPassword = asyncHandler(async (req: Request, res: Response) => {
    const deviceInfo = req.body.deviceInfo || {};
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];

    const result = await authService.loginWithPassword(req.body, deviceInfo, ipAddress, userAgent);

    // Set HttpOnly cookies
    setTokenCookies(res, result.tokens.accessToken, result.tokens.refreshToken, { maxAgeSeconds: result.tokens.expiresIn });

    // Omit tokens from response body
    const { tokens, ...publicData } = result;
    return sendSuccess(res, publicData, 'Login successful');
  });

  /**
   * Register patient with OTP
   */
  registerPatient = asyncHandler(async (req: Request, res: Response) => {
    const deviceInfo = req.body.deviceInfo || {};
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];

    const result = await authService.registerPatient(req.body, deviceInfo, ipAddress, userAgent);

    setTokenCookies(res, result.tokens.accessToken, result.tokens.refreshToken, { maxAgeSeconds: result.tokens.expiresIn });

    // Omit tokens from response body
    const { tokens, ...publicData } = result;
    return sendCreated(res, publicData, 'Registration successful');
  });

  /**
   * Register hospital with OTP
   */
  registerHospital = asyncHandler(async (req: Request, res: Response) => {
    const deviceInfo = req.body.deviceInfo || {};
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];

    const result = await authService.registerHospital(req.body, deviceInfo, ipAddress, userAgent);

    setTokenCookies(res, result.tokens.accessToken, result.tokens.refreshToken, { maxAgeSeconds: result.tokens.expiresIn });

    // Omit tokens from response body
    const { tokens, ...publicData } = result;
    return sendCreated(res, publicData, 'Hospital registration successful');
  });

  /**
   * Complete Initial Account Registration (Step 2)
   */
  completeUserRegistration = asyncHandler(async (req: Request, res: Response) => {
    const deviceInfo = req.body.deviceInfo || {};
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];

    const result = await authService.completeUserRegistration(req.body, deviceInfo, ipAddress, userAgent);

    setTokenCookies(res, result.tokens.accessToken, result.tokens.refreshToken, { maxAgeSeconds: result.tokens.expiresIn });

    const { tokens, ...publicData } = result;
    return sendCreated(res, publicData, 'Registration successful');
  });

  /**
   * Hospital Step 3: Base Profile (Must be authenticated)
   */
  registerHospitalProfile = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.registerHospitalProfile((req as any).user.id, req.body);
    return sendSuccess(res, result, 'Hospital profile updated');
  });

  /**
   * Hospital Step 4: Compliance (Must be authenticated)
   */
  registerHospitalCompliance = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.registerHospitalCompliance((req as any).user.id, req.body);
    return sendSuccess(res, result, 'Hospital compliance updated');
  });

  /**
   * Hospital Step 5: Address (Must be authenticated)
   */
  registerHospitalAddress = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.registerHospitalAddress((req as any).user.id, req.body);
    return sendSuccess(res, result, 'Hospital registration completed');
  });

  /**
   * Initiate Google OAuth
   */
  initiateGoogleOAuth = asyncHandler(async (req: Request, res: Response) => {
    const redirectUrl = req.query.redirectUrl as string || env.CORS_ORIGIN;
    const { url } = await supabaseOAuthService.generateGoogleOAuthUrl(redirectUrl);
    return sendSuccess(res, { url }, 'Google OAuth URL generated');
  });

  /**
   * Handle Google OAuth Callback
   */
  googleCallback = asyncHandler(async (req: Request, res: Response) => {
    const { code, state } = req.query as { code: string; state: string };
    const deviceInfo = {}; // Extracted from middleware or headers if needed
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];

    const result = await supabaseOAuthService.handleGoogleCallback(code, state, deviceInfo, ipAddress, userAgent);

    setTokenCookies(res, result.tokens.accessToken, result.tokens.refreshToken, { maxAgeSeconds: result.tokens.expiresIn });

    // If query contains 'redirect', we might want to redirect instead of JSON response
    if (req.query.redirect === 'true' && req.query.redirectTo) {
      return res.redirect(req.query.redirectTo as string);
    }

    // Omit tokens from response body
    const { tokens, ...publicData } = result;
    return sendSuccess(res, publicData, 'Google login successful');
  });

  /**
   * Handle Google OAuth with Access Token (for implicit flow)
   * Used when Supabase returns tokens directly instead of authorization code
   */
  googleCallbackWithToken = asyncHandler(async (req: Request, res: Response) => {
    const { accessToken, userId } = req.body;
    const deviceInfo = req.body.deviceInfo || {};
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];

    const result = await supabaseOAuthService.handleGoogleCallbackWithToken(
      accessToken,
      userId,
      deviceInfo,
      ipAddress,
      userAgent
    );

    setTokenCookies(res, result.tokens.accessToken, result.tokens.refreshToken, { maxAgeSeconds: result.tokens.expiresIn });

    // Omit tokens from response body
    const { tokens, ...publicData } = result;
    return sendSuccess(res, publicData, 'Google login successful');
  });

  /**
   * Complete Google OAuth with Phone
   */
  completeGoogleAuth = asyncHandler(async (req: Request, res: Response) => {
    const { accessToken, userId, phone } = req.body;
    const deviceInfo = req.body.deviceInfo || {};
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];

    const result = await supabaseOAuthService.completeGoogleCallbackWithToken(
      accessToken,
      userId,
      phone,
      deviceInfo,
      ipAddress,
      userAgent
    );

    setTokenCookies(res, result.tokens.accessToken, result.tokens.refreshToken, { maxAgeSeconds: result.tokens.expiresIn });

    // Omit tokens from response body
    const { tokens, ...publicData } = result;
    return sendSuccess(res, publicData, 'Google registration completed');
  });

  /**
   * Refresh Access Token
   */
  refreshToken = asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken: bodyToken } = req.body;
    const { refreshToken: cookieToken } = getTokensFromReq(req);
    const refreshToken = bodyToken || cookieToken;

    const deviceInfo = req.body.deviceInfo || {};
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];

    const result = await authService.refreshAccessToken({ refreshToken }, deviceInfo, ipAddress, userAgent);

    setTokenCookies(res, result.accessToken, result.refreshToken, { maxAgeSeconds: result.expiresIn });

    // For refresh, we only return expiresIn in the body, or nothing
    return sendSuccess(res, { expiresIn: result.expiresIn }, 'Token refreshed successfully');
  });

  /**
   * Logout
   */
  logout = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = (req as any).user!;
    await authService.logout(sessionId);

    clearTokenCookies(res);

    return sendSuccess(res, null, 'Logged out successfully');
  });

  /**
   * Get Current User Profile
   */
  getProfile = asyncHandler(async (req: Request, res: Response) => {
    const profile = await authService.getProfile((req as any).user!.userId);
    return sendSuccess(res, profile, 'Profile retrieved successfully');
  });

  /**
   * Update Current User Profile
   */
  updateProfile = asyncHandler(async (req: Request, res: Response) => {
    const profile = await authService.updateProfile((req as any).user!.userId, req.body);
    return sendSuccess(res, profile, 'Profile updated successfully');
  });
}

export const authController = new AuthController();
