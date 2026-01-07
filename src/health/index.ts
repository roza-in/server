import { Router, Request, Response } from 'express';
import { getSupabaseAdmin } from '../config/db.js';
import { sendSuccess } from '../common/response.js';

const router = Router();

/**
 * Health check endpoint
 * GET /health
 */
router.get('/', async (_req: Request, res: Response) => {
  const startTime = Date.now();

  // Check database connection
  let dbStatus = 'healthy';
  let dbLatency = 0;

  try {
    const dbStart = Date.now();
    const supabase = getSupabaseAdmin();
    await supabase.from('users').select('id').limit(1);
    dbLatency = Date.now() - dbStart;
  } catch (error) {
    dbStatus = 'unhealthy';
  }

  const health = {
    status: dbStatus === 'healthy' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    checks: {
      database: {
        status: dbStatus,
        latency: `${dbLatency}ms`,
      },
      memory: {
        used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
      },
    },
    responseTime: `${Date.now() - startTime}ms`,
  };

  return sendSuccess(res, health);
});

/**
 * Readiness check
 * GET /health/ready
 */
router.get('/ready', async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from('users').select('id').limit(1);
    return sendSuccess(res, { ready: true });
  } catch (error) {
    res.status(503).json({ success: false, ready: false, error: 'Database not ready' });
  }
});

/**
 * Liveness check
 * GET /health/live
 */
router.get('/live', (_req: Request, res: Response) => {
  return sendSuccess(res, { live: true });
});

export const healthRoutes = router;
