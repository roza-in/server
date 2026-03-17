import crypto from 'crypto';

/**
 * Generate a cryptographically secure OTP using crypto.randomInt
 */
export const generateOTP = (length = 6): string => {
    let otp = '';
    for (let i = 0; i < length; i++) {
        otp += crypto.randomInt(0, 10).toString();
    }
    return otp;
};

export const hashString = (text: string): string => {
    return crypto.createHash('sha256').update(text).digest('hex');
};

export const generateRandomToken = (bytes = 32): string => {
    return crypto.randomBytes(bytes).toString('hex');
};
