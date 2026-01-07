import http from 'http';
import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './common/logger.js';

/**
 * Create HTTP server
 */
const server = http.createServer(app);

/**
 * Normalize port
 */
function normalizePort(val: string | number): number {
  const port = typeof val === 'string' ? parseInt(val, 10) : val;
  if (isNaN(port) || port < 0) {
    return 3000;
  }
  return port;
}

const PORT = normalizePort(env.PORT);

/**
 * Handle server errors
 */
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof PORT === 'string' ? `Pipe ${PORT}` : `Port ${PORT}`;

  switch (error.code) {
    case 'EACCES':
      logger.error(`${bind} requires elevated privileges`);
      process.exit(1);
    case 'EADDRINUSE':
      logger.error(`${bind} is already in use`);
      process.exit(1);
    default:
      throw error;
  }
});

/**
 * Handle server listening
 */
server.on('listening', () => {
  const addr = server.address();
  const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr?.port}`;
  logger.info(`Server listening on ${bind}`);
  logger.info(`Environment: ${env.NODE_ENV}`);
  logger.info(`API: http://localhost:${PORT}/api/v1`);
  logger.info(`Health: http://localhost:${PORT}/health`);
});

/**
 * Graceful shutdown
 */
function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully...`);
  
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

/**
 * Start server
 */
server.listen(PORT);

export { server };
