import { Router } from 'express';
import { authController } from './auth.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { authLimiter, otpLimiter } from '../../middlewares/rate-limit.middleware.js';
import { getCsrfToken } from '../../middlewares/csrf.middleware.js';
import {
    sendOTPSchema,
    verifyOTPSchema,
    registerPatientSchema,
    registerHospitalSchema,
    passwordLoginSchema,
    refreshTokenSchema,
    updateProfileSchema,
    completeUserRegistrationSchema,
    registerHospitalProfileSchema,
    registerHospitalComplianceSchema,
    registerHospitalAddressSchema,
    resetPasswordSchema
} from './auth.validator.js';

const router = Router();

/**
 * Public Routes
 */

// OTP Delivery
router.post('/otp/send', authLimiter, validate(sendOTPSchema), authController.sendOTP);
router.post('/otp/validate', authLimiter, validate(verifyOTPSchema), authController.validateRegistrationOTP);

// Login
router.post('/login/password', authLimiter, validate(passwordLoginSchema), authController.loginWithPassword);
router.post('/login/otp', authLimiter, validate(verifyOTPSchema), authController.loginWithOTP);

// Registration (Legacy/Single-step)
router.post('/register/patient', authLimiter, validate(registerPatientSchema), authController.registerPatient);
router.post('/register/hospital', authLimiter, validate(registerHospitalSchema), authController.registerHospital);

// Registration (Multi-step)
router.post('/register/initiate', authLimiter, validate(sendOTPSchema), authController.sendOTP);
router.post('/register/complete-user', authLimiter, validate(completeUserRegistrationSchema), authController.completeUserRegistration);
router.post('/register/hospital-profile', authMiddleware, validate(registerHospitalProfileSchema), authController.registerHospitalProfile);
router.post('/register/hospital-compliance', authMiddleware, validate(registerHospitalComplianceSchema), authController.registerHospitalCompliance);
router.post('/register/hospital-address', authMiddleware, validate(registerHospitalAddressSchema), authController.registerHospitalAddress);

// Google OAuth
router.get('/google/url', authController.initiateGoogleOAuth);
router.get('/google/callback', authLimiter, authController.googleCallback);
router.post('/google/callback', authLimiter, authController.googleCallbackWithToken);
router.post('/google/complete', authLimiter, authController.completeGoogleAuth);

// Token Management
router.post('/refresh', validate(refreshTokenSchema), authController.refreshToken);

// CSRF Token (I8) — SPA bootstrap endpoint
router.get('/csrf-token', getCsrfToken);

// Password Reset (C7 fix)
router.post('/password/request-reset', authLimiter, authController.requestPasswordReset);
router.post('/password/reset', authLimiter, validate(resetPasswordSchema), authController.resetPassword);

/**
 * Protected Routes
 */
router.use(authMiddleware);

router.post('/logout', authController.logout);
router.get('/me', authController.getProfile);
router.put('/profile', validate(updateProfileSchema), authController.updateProfile);

export default router;
