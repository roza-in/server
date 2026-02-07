/**
 * ROZX Healthcare Platform - sensitive data scrubbing utility
 */

/**
 * Keys that should be masked in logs
 */
const SENSITIVE_KEYS = [
    'password',
    'confirmPassword',
    'token',
    'accessToken',
    'refreshToken',
    'otp',
    'secret',
    'apiKey',
    'cvv',
    'cardNumber',
    'ssn',
    'pan',
    'aadhaar'
];

/**
 * Recursively masks sensitive fields in an object or array
 * @param data The data to scrub
 * @returns A scrubbed copy of the data
 */
export function scrubSensitiveData(data: any): any {
    if (!data || typeof data !== 'object') {
        return data;
    }

    // Handle arrays
    if (Array.isArray(data)) {
        return data.map(item => scrubSensitiveData(item));
    }

    // Handle objects
    const scrubbed: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
        // Check if key is sensitive
        const isSensitive = SENSITIVE_KEYS.some(sensitiveKey =>
            key.toLowerCase().includes(sensitiveKey.toLowerCase())
        );

        if (isSensitive && value !== null && value !== undefined) {
            // Mask the value
            if (typeof value === 'string') {
                if (value.length <= 4) {
                    scrubbed[key] = '[REDACTED]';
                } else {
                    // Show first 2 characters for some context (except for very sensitive stuff like passwords)
                    const lowerKey = key.toLowerCase();
                    if (lowerKey.includes('password') || lowerKey.includes('otp') || lowerKey.includes('cvv')) {
                        scrubbed[key] = '[REDACTED]';
                    } else {
                        scrubbed[key] = `${value.substring(0, 2)}...${value.substring(value.length - 2)}`;
                    }
                }
            } else {
                scrubbed[key] = '[REDACTED]';
            }
        } else if (typeof value === 'object' && value !== null) {
            // Recurse for nested objects
            scrubbed[key] = scrubSensitiveData(value);
        } else {
            // Copy as is
            scrubbed[key] = value;
        }
    }

    return scrubbed;
}
