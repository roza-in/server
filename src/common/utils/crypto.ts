import crypto from 'crypto';

export const generateOTP = (length = 6): string => {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
        otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp;
};

export const hashString = (text: string): string => {
    return crypto.createHash('sha256').update(text).digest('hex');
};

export const generateRandomToken = (bytes = 32): string => {
    return crypto.randomBytes(bytes).toString('hex');
};
