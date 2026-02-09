import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { filterXSS } from 'xss';
import { env, isProduction } from './config/env.js';
import { logger } from './config/logger.js';
import routes from './routes/index.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { requestIdMiddleware } from './middlewares/request-id.middleware.js';
import { metricsMiddleware, getMetricsSummary } from './config/metrics.js';
import { rateLimit } from './middlewares/rate-limit.middleware.js';
import { authMiddleware } from './middlewares/auth.middleware.js';
import { roleGuard } from './middlewares/role.middleware.js';

/**
 * XSS Sanitization - Recursively sanitize object values
 */
const sanitizeValue = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return filterXSS(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, sanitizeValue(v)])
    );
  }
  return value;
};

/**
 * XSS Sanitization Middleware
 */
const xssSanitizer = (req: Request, _res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    const sanitizedBody = sanitizeValue(req.body);
    // Mutate properties to avoid reassigning read-only req.body
    Object.keys(req.body).forEach(key => delete (req.body as any)[key]);
    Object.assign(req.body, sanitizedBody);
  }
  next();
};

/**
 * CORS Origin Validator
 */
const corsOriginValidator = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
  // Allow requests with no origin (mobile apps, curl, etc.)
  if (!origin) {
    return callback(null, true);
  }

  const allowedOrigins = env.CORS_ORIGIN.split(',').map(o => o.trim());

  // Check if origin matches any allowed origin
  const isAllowed = allowedOrigins.some(allowed => {
    // SECURITY: Block wildcard (*) in production to prevent CORS bypass
    if (allowed === '*') {
      if (isProduction) {
        logger.warn('CORS wildcard (*) is not allowed in production - rejecting origin');
        return false;
      }
      return true; // Allow in development only
    }
    if (allowed === origin) return true;
    // Support wildcard subdomains like *.rozx.in
    if (allowed.startsWith('*.')) {
      const domain = allowed.slice(2);
      return origin.endsWith(domain);
    }
    return false;
  });

  if (isAllowed) {
    callback(null, true);
  } else {
    logger.warn(`CORS blocked origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  }
};

/**
 * ROZX Healthcare Platform - Express App Bootstrap
 */
export function createApp(): Application {
  const app = express();

  // 1. Trust proxy (for rate limiting, load balancers)
  app.set('trust proxy', 1);

  // 2. Security Headers with Helmet
  app.use((helmet as any)({
    // Content Security Policy
    contentSecurityPolicy: isProduction ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://*.googletagmanager.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        imgSrc: ["'self'", 'data:', 'https:', 'blob:', 'https://*,google-analytics.com', 'https://*.googletagmanager.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        connectSrc: ["'self'", 'https://api.razorpay.com', 'https://*.sentry.io', 'https://*.google-analytics.com', 'https://*.analytics.google.com', 'https://*.googletagmanager.com'],
        frameSrc: ["'self'", 'https://api.razorpay.com'], // For Razorpay checkout
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    } : false, // Disable CSP in development for easier debugging

    // HTTP Strict Transport Security
    hsts: isProduction ? {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    } : false,

    // Prevent clickjacking
    frameguard: { action: 'deny' },

    // Prevent MIME type sniffing
    noSniff: true,

    // Referrer Policy
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));

  // 3. CORS with validation
  app.use(cors({
    origin: corsOriginValidator,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Idempotency-Key'],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  }));

  // 4. Body parsing with size limits
  app.use(express.json({
    limit: '10mb',
    // Reject requests with wrong content-type
    strict: true,
  }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 5. XSS Sanitization (after body parsing)
  app.use(xssSanitizer);

  // 6. Cookie Parser
  app.use(cookieParser(env.COOKIE_SECRET));

  // 7. Request ID and timing
  app.use(requestIdMiddleware);

  // 8. Performance Metrics (track response times, throughput)
  app.use(metricsMiddleware);

  // 9. Rate Limiting (Global Application protection)
  // strict limiter based on env config
  app.use(rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX_REQUESTS,
    message: 'Too many requests from this IP, please try again later.',
    prefix: 'global'
  }));

  // 8. Structured Request Logging
  if (env.NODE_ENV !== 'test') {
    app.use(morgan(
      isProduction
        ? ':remote-addr :method :url :status :res[content-length] - :response-time ms'
        : 'dev',
      {
        stream: {
          write: (message: string) => logger.info(message.trim()),
        },
        // Skip health check logging in production
        skip: (req) => isProduction && req.url === '/health',
      }
    ));
  }

  // 9. API Routes
  app.use(`/api/${env.API_VERSION}`, routes);

  // 10. Health Check (detailed)
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'up',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    });
  });

  // 11. Metrics Endpoint (for monitoring - admin only)
  app.get('/metrics', authMiddleware, roleGuard('admin'), (_req: Request, res: Response) => {
    const metrics = getMetricsSummary();
    res.json({ success: true, data: metrics });
  });

  // 11. Root endpoint
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: 'ROZX Healthcare API',
      version: process.env.npm_package_version || '1.0.0',
      environment: env.NODE_ENV,
    });
  });

  // 12. 404 Handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      message: 'Endpoint not found',
      error: { code: 'NOT_FOUND' },
    });
  });

  // 13. Global Error Handler
  app.use(errorMiddleware);

  return app;
}

export const app = createApp();
export default app;

