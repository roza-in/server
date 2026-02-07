import http from 'http';
import app from './app.js';
import { env, features } from './config/env.js';
import { logger } from './config/logger.js';
import { db } from './config/database.js';
import { initSentry, captureException } from './config/sentry.js';
import { initUpstashRedis } from './config/redis.js';

/**
 * ROZX Healthcare Platform - HTTP Server Start
 */
const startServer = async () => {
  try {
    // 1. Initialize Sentry (must be first for error tracking)
    initSentry();

    // 2. Initialize Redis (for rate limiting, caching)
    if (features.upstashRedis) {
      initUpstashRedis();
    }

    // 3. Check Database Connection
    const isDbConnected = await db.checkConnection();
    if (!isDbConnected) {
      logger.error('Failed to connect to database. Exiting...');
      process.exit(1);
    }
    logger.info('Database connected successfully');

    // 4. Configure Port
    const PORT = env.PORT || 5000;
    const server = http.createServer(app);

    // 5. Start Listening
    server.listen(PORT, () => {
      logger.info(`Server running in ${env.NODE_ENV} mode on port ${PORT}`);
      logger.info(`API: http://localhost:${PORT}/api/v1`);
      if (features.sentry) logger.info('Sentry error tracking enabled');
      if (features.upstashRedis) logger.info('Upstash Redis rate limiting enabled');
    });

    // 6. Graceful Shutdown with connection draining
    let isShuttingDown = false;

    const shutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      logger.info(`${signal} received. Shutting down gracefully...`);

      // Stop accepting new connections
      server.close(() => {
        logger.info('HTTP server closed - no new connections');
      });

      // Wait for existing connections to drain (max 30s)
      const drainTimeout = 30000;
      const drainStart = Date.now();

      await new Promise<void>((resolve) => {
        const checkDrain = () => {
          server.getConnections((err, count) => {
            if (err || count === 0 || Date.now() - drainStart > drainTimeout) {
              resolve();
            } else {
              logger.info(`Waiting for ${count} connections to close...`);
              setTimeout(checkDrain, 1000);
            }
          });
        };
        checkDrain();
      });

      logger.info('Shutdown complete');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // 7. Handle uncaught exceptions and rejections
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      captureException(error, { extra: { type: 'uncaughtException' } });
      shutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled Rejection:', reason);
      if (reason instanceof Error) {
        captureException(reason, { extra: { type: 'unhandledRejection' } });
      }
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    if (error instanceof Error) {
      captureException(error, { extra: { type: 'startupFailure' } });
    }
    process.exit(1);
  }
};

startServer();

