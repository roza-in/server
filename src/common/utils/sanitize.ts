/**
 * ROZX Healthcare Platform - Input Sanitization Utilities
 * 
 * Security utilities for sanitizing user input before use in database queries.
 */

/**
 * Sanitize search input for use in PostgREST/Supabase filter strings
 * Removes special characters that could be used for filter injection attacks.
 * 
 * @param input - Raw user input
 * @param maxLength - Maximum allowed length (default: 100)
 * @returns Sanitized string safe for use in .ilike(), .or() filters
 */
export function sanitizeSearchInput(input: string, maxLength: number = 100): string {
    if (!input || typeof input !== 'string') {
        return '';
    }

    return input
        // Remove PostgREST filter special characters
        .replace(/[%_(),.;:!@#$^&*=+\[\]{}\\|<>?/`~]/g, '')
        // Escape single quotes (SQL standard)
        .replace(/'/g, "''")
        // Remove control characters
        .replace(/[\x00-\x1F\x7F]/g, '')
        // Trim whitespace
        .trim()
        // Limit length to prevent abuse
        .substring(0, maxLength);
}

/**
 * Validate time format (HH:MM or HH:MM:SS)
 * Used to validate time strings before interpolation in schedule queries.
 * 
 * @param time - Time string to validate
 * @returns true if valid time format
 */
export function isValidTimeFormat(time: string): boolean {
    if (!time || typeof time !== 'string') {
        return false;
    }

    // Match HH:MM or HH:MM:SS format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
    return timeRegex.test(time);
}

/**
 * Sanitize string for safe logging (removes potential log injection)
 * 
 * @param input - Raw input string
 * @param maxLength - Maximum allowed length (default: 500)
 * @returns Sanitized string safe for logging
 */
export function sanitizeForLogging(input: string, maxLength: number = 500): string {
    if (!input || typeof input !== 'string') {
        return '';
    }

    return input
        // Remove newlines (prevent log injection)
        .replace(/[\r\n]/g, ' ')
        // Remove control characters
        .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '')
        // Limit length
        .substring(0, maxLength);
}

/**
 * Validate and sanitize UUID format
 * 
 * @param uuid - Input string to validate as UUID
 * @returns true if valid UUID v4 format
 */
export function isValidUUID(uuid: string): boolean {
    if (!uuid || typeof uuid !== 'string') {
        return false;
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}
