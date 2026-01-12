import { Router } from 'express';
import {
  sendOTP,
  verifyOTP,
  loginWithPassword,
  registerPatient,
  registerHospital,
  refreshToken,
  getMe,
  logout,
  googleOAuth,
  getGoogleOAuthUrl,
  handleGoogleCallback,
} from '../modules/auth/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { rateLimitOTP, rateLimitAuth } from '../middlewares/rate-limit.middleware.js';

const router = Router();

/**
 * @route POST /api/v1/auth/otp/send
 * @desc Send OTP (SMS or Email) for authentication
 * @access Public
 */
router.post('/otp/send', rateLimitOTP, sendOTP);

/**
 * @route POST /api/v1/auth/otp/verify
 * @desc Verify OTP and login
 * @access Public
 */
router.post('/otp/verify', rateLimitOTP, verifyOTP);

/**
 * @route POST /api/v1/auth/login/password
 * @desc Login using email + password
 * @access Public
 */
router.post('/login/password', rateLimitAuth, loginWithPassword);

/**
 * @route POST /api/v1/auth/google
 * @desc Google OAuth login/register (DEPRECATED - use Supabase Auth flow)
 * @access Public
 * @deprecated Use GET /auth/google/url + POST /auth/google/callback instead
 */
router.post('/google', rateLimitAuth, googleOAuth);

/**
 * @route GET /api/v1/auth/google/url
 * @desc Get Google OAuth redirect URL (Supabase Auth)
 * @access Public
 * @query {string} redirectUrl - Client redirect URL after OAuth
 */
router.get('/google/url', getGoogleOAuthUrl);

/**
 * @route POST /api/v1/auth/google/callback
 * @desc Handle Google OAuth callback from Supabase Auth
 * @access Public
 * @body {string} code - OAuth authorization code
 * @body {string} state - CSRF state token
 */
router.post('/google/callback', rateLimitAuth, handleGoogleCallback);
router.post('/google/complete', rateLimitAuth, async (req, res, next) => {
  // Lazy import controller to avoid circular deps in some setups
  try {
    const { completeGoogleCallback } = await import('../modules/auth/auth.controller.js');
    return completeGoogleCallback(req, res, next);
  } catch (e) {
    return next(e);
  }
});

/**
 * @route POST /api/v1/auth/register/patient
 * @desc Complete patient registration
 * @access Public
 */
router.post('/register/patient', rateLimitAuth, registerPatient);

/**
 * @route POST /api/v1/auth/register/hospital
 * @desc Register as hospital (creates hospital + admin user)
 * @access Public
 */
router.post('/register/hospital', rateLimitAuth, registerHospital);

/**
 * @route POST /api/v1/auth/refresh
 * @desc Refresh access token
 * @access Public (requires refresh token)
 */
router.post('/refresh', refreshToken);

/**
 * @route GET /api/v1/auth/me
 * @desc Get current user profile
 * @access Private
 */
router.get('/me', authenticate, getMe);

/**
 * @route POST /api/v1/auth/logout
 * @desc Logout and invalidate session
 * @access Private
 */
router.post('/logout', authenticate, logout);

export const authRoutes = router;
