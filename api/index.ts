/**
 * Vercel Serverless Entry Point
 * Wraps Express app for serverless execution with CORS preflight handling
 */
import { createApp } from '../src/app.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Lazy-load app to avoid cold start issues
let app: ReturnType<typeof createApp> | null = null;

const getApp = () => {
    if (!app) {
        app = createApp();
    }
    return app;
};

// Allowed CORS origins from environment
const getAllowedOrigins = (): string[] => {
    const corsOrigin = process.env.CORS_ORIGIN || '';
    return corsOrigin.split(',').map(o => o.trim()).filter(Boolean);
};

const debugLog = (msg: string, data?: any) => {
    // Only log in non-production or if explicitly enabled
    if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_CORS === 'true') {
        console.log(`[CORS-DEBUG] ${msg}`, data || '');
    }
};

// Fast origin validation for preflight
const isOriginAllowed = (origin: string): boolean => {
    const allowed = getAllowedOrigins();

    // Direct match
    if (allowed.includes(origin)) return true;

    // Production fail-safe: allow all *.rozx.in subdomains
    if (origin === 'https://rozx.in' || origin.endsWith('.rozx.in')) {
        return true;
    }

    // Wildcard pattern matching (e.g., https://*.rozx.in)
    return allowed.some(pattern => {
        if (pattern.includes('*')) {
            const regex = new RegExp(
                '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace('\\*', '[^.]+') + '$'
            );
            return regex.test(origin);
        }
        return false;
    });
};

// CORS headers configuration
const CORS_HEADERS = {
    methods: 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    headers: [
        'Content-Type',
        'Authorization',
        'X-Request-ID',
        'X-Idempotency-Key',
        'X-Requested-With',
        'Accept',
        'Accept-Version',
        'Date',
        'X-Api-Version',
        'X-CSRF-Token'
    ].join(', '),
    maxAge: '86400' // 24 hours preflight cache
};

/**
 * Serverless handler for Vercel
 * Handles CORS preflight and routes to Express app
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
    const origin = req.headers.origin as string | undefined;
    const method = req.method;

    debugLog(`Incoming ${method} request`, { url: req.url, origin });

    // Handle CORS preflight (OPTIONS) requests
    if (method === 'OPTIONS') {
        if (origin && isOriginAllowed(origin)) {
            debugLog(`Allowed OPTIONS for origin: ${origin}`);
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Access-Control-Allow-Methods', CORS_HEADERS.methods);
            res.setHeader('Access-Control-Allow-Headers', CORS_HEADERS.headers);
            res.setHeader('Access-Control-Max-Age', CORS_HEADERS.maxAge);
            return res.status(204).end();
        }
        debugLog(`Blocked OPTIONS for origin: ${origin}`);
        // Reject unauthorized preflight
        return res.status(403).json({ error: 'CORS not allowed' });
    }

    // Set CORS headers for actual requests
    if (origin && isOriginAllowed(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else if (origin) {
        debugLog(`Warning: Origin ${origin} not allowed for ${method} request`);
    }

    // Pass to Express app
    return getApp()(req as any, res as any);
}
