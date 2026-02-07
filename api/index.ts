/**
 * Vercel Serverless Entry Point
 * Wraps Express app for serverless execution
 */
import { createApp } from '../src/app.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const app = createApp();

/**
 * Serverless handler for Vercel
 * Converts Vercel request/response to Express format
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
    // Express app handles the request
    return app(req as any, res as any);
}
