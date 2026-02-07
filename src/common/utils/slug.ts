/**
 * Generate a URL-friendly slug from a string
 */
export const slugify = (text: string): string => {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')     // Replace spaces with -
        .replace(/[^\w-]+/g, '')  // Remove all non-word chars
        .replace(/--+/g, '-')    // Replace multiple - with single -
        .replace(/^-+/, '')       // Trim - from start
        .replace(/-+$/, '');      // Trim - from end
};

/**
 * Append a random string to a slug to ensure uniqueness
 */
export const uniqueSlug = (text: string): string => {
    const random = Math.random().toString(36).substring(2, 7);
    return `${slugify(text)}-${random}`;
};
