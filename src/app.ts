import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { logger } from './common/logger.js';
import { apiRoutes } from './routes/index.js';
import { healthRoutes } from './health/index.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';

/**
 * Create and configure Express application
 */
export function createApp(): Application {
  const app = express();

  // Trust proxy (for rate limiting behind reverse proxy)
  app.set('trust proxy', 1);

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: env.NODE_ENV === 'production',
    crossOriginEmbedderPolicy: false,
  }));

  // CORS configuration
  app.use(cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  }));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logging
  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev', {
      stream: {
        write: (message: string) => logger.info(message.trim()),
      },
    }));
  }

  // Request ID middleware
  app.use((req: Request, _res: Response, next) => {
    req.headers['x-request-id'] = req.headers['x-request-id'] || crypto.randomUUID();
    next();
  });

  // Health check routes (public, not under /api/v1)
  app.use('/health', healthRoutes);

  // API routes
  app.use('/api/v1', apiRoutes);

  // Root route
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: 'ROZX Healthcare API',
      version: '1.0.0',
      description: 'Healthcare platform backend API',
      docs: '/api/v1/docs',
      health: '/health',
    });
  });

  // 404 handler
  app.use(notFoundHandler);

  // Global error handler
  app.use(errorHandler);

  return app;
}

// Export app instance
export const app = createApp();
