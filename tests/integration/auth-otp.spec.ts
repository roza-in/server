import { jest, describe, beforeEach, it, expect } from '@jest/globals';

const signInWithOtpMock = jest.fn<any>();
const verifyOtpMock = jest.fn<any>();

let supabaseMock: any;

const buildSupabaseMock = () => {
  const usersBuilder = {
    select: jest.fn(() => ({
      eq: jest.fn<any>().mockReturnThis(),
      single: jest.fn<any>().mockResolvedValue({
        data: { id: 'user-1', is_active: true, is_blocked: false },
        error: null,
      }),
    })),
  };

  return {
    from: jest.fn((table: string) => {
      if (table === 'users') return usersBuilder;
      return {
        select: jest.fn(() => ({ single: jest.fn<any>().mockResolvedValue({ data: null, error: null }) })),
      };
    }),
    auth: {
      signInWithOtp: signInWithOtpMock,
      verifyOtp: verifyOtpMock,
    },
  };
};

await jest.unstable_mockModule('../../src/config/env.js', () => ({
  env: {
    OTP_LENGTH: 6,
    OTP_EXPIRY_MINUTES: 15,
    OTP_MAX_ATTEMPTS: 3,
    GOOGLE_CLIENT_ID: undefined,
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_ROLE_KEY: 'service',
    JWT_SECRET: 'secretsecretsecretsecretsecretsecret',
    JWT_ACCESS_TOKEN_EXPIRES_IN: '1h',
    JWT_REFRESH_TOKEN_EXPIRES_IN: '7d',
    JWT_ISSUER: 'test',
    RAZORPAY_KEY_ID: 'key',
    RAZORPAY_KEY_SECRET: 'secret',
    WHATSAPP_API_VERSION: 'v18.0',
    WHATSAPP_PHONE_NUMBER_ID: 'phone',
    WHATSAPP_ACCESS_TOKEN: 'token',
    WHATSAPP_VERIFY_TOKEN: 'verify',
    TWILIO_ACCOUNT_SID: 'sid',
    TWILIO_AUTH_TOKEN: 'auth',
    TWILIO_PHONE_NUMBER: '+10000000000',
    SENDGRID_API_KEY: 'SG.test',
    SENDGRID_EMAIL_FROM: 'test@example.com',
    CORS_ORIGIN: 'http://localhost:3000',
    CORS_CREDENTIALS: 'true',
    RATE_LIMIT_WINDOW_MS: '60000',
    RATE_LIMIT_MAX_REQUESTS: '100',
    PLATFORM_FEE_ONLINE_PERCENT: '7',
    PLATFORM_FEE_IN_PERSON_PERCENT: '4',
    PLATFORM_FEE_WALKIN_PERCENT: '2',
    PLATFORM_FEE_FOLLOWUP_PERCENT: '3',
    GST_RATE_PERCENT: '18',
  },
  isDevelopment: true,
}));

await jest.unstable_mockModule('../../src/config/db.js', () => ({
  getSupabaseAdmin: () => supabaseMock,
}));

const { authService } = await import('../../src/modules/auth/auth.service.js');

describe('AuthService OTP via Supabase Auth', () => {
  beforeEach(() => {
    signInWithOtpMock.mockReset();
    verifyOtpMock.mockReset();
    supabaseMock = buildSupabaseMock();
    (authService as any).supabase = supabaseMock;
  });

  it('sends OTP via Supabase Auth signInWithOtp', async () => {
    signInWithOtpMock.mockResolvedValue({ data: null, error: null });

    const result = await authService.sendOTP({ phone: '+911234567890', purpose: 'registration' } as any);

    expect(signInWithOtpMock).toHaveBeenCalledWith({
      phone: '+911234567890',
      email: undefined,
    });
    expect(result.message).toContain('sent successfully');
    expect(result.phone).toBe('+911234567890');
  });

  it('handles Supabase OTP send failure', async () => {
    signInWithOtpMock.mockResolvedValue({
      data: null,
      error: { message: 'Failed to send SMS' },
    });

    await expect(
      authService.sendOTP({ phone: '+911234567890', purpose: 'registration' } as any)
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(signInWithOtpMock).toHaveBeenCalledTimes(1);
  });

  it('verifies OTP via Supabase Auth verifyOtp', async () => {
    verifyOtpMock.mockResolvedValue({
      data: { user: { id: 'user-123', phone: '+911234567890' } },
      error: null,
    });

    await (authService as any).verifyOTP('+911234567890', '123456');

    expect(verifyOtpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: '+911234567890',
        token: '123456',
        type: 'sms',
      })
    );
  });

  it('throws OTPExpiredError when token is expired', async () => {
    verifyOtpMock.mockResolvedValue({
      data: null,
      error: { message: 'Token has expired', code: 'otp_expired' },
    });

    await expect(
      (authService as any).verifyOTP('+911234567890', '123456')
    ).rejects.toMatchObject({ code: 'OTP_EXPIRED' });
  });

  it('throws OTPInvalidError when token is invalid', async () => {
    verifyOtpMock.mockResolvedValue({
      data: null,
      error: { message: 'Invalid OTP token', code: 'otp_invalid' },
    });

    await expect(
      (authService as any).verifyOTP('+911234567890', '000000')
    ).rejects.toMatchObject({ code: 'OTP_INVALID' });
  });

  it('validates user exists during login OTP send', async () => {
    signInWithOtpMock.mockResolvedValue({ data: null, error: null });
    supabaseMock = buildSupabaseMock();
    const selectMock = jest.fn<any>().mockReturnValue({
      eq: jest.fn<any>().mockReturnValue({
        single: jest.fn<any>().mockResolvedValue({ data: null, error: 'Not found' }),
      }),
    });
    supabaseMock.from = jest.fn<any>(() => ({ select: selectMock }));
    (authService as any).supabase = supabaseMock;

    await expect(
      authService.sendOTP({ phone: '+911234567890', purpose: 'login' } as any)
    ).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
  });
});
