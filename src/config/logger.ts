import winston from 'winston';
import { env, isProduction } from './env.js';

// Custom format for development (pretty, colored output)
const devFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
    const ctx = context ? `[${context}] ` : '';
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}: ${ctx}${message}${metaStr}`;
  })
);

// Custom format for production (structured JSON)
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create the base Winston logger
const winstonLogger = winston.createLogger({
  level: env.LOG_LEVEL || 'info',
  format: isProduction ? prodFormat : devFormat,
  defaultMeta: { service: 'rozx-api' },
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error'],
    }),
  ],
});

import { scrubSensitiveData } from '../common/utils/scrub-data.js';

/**
 * Logger wrapper class for backward compatibility
 * Maintains the same API as the previous custom logger
 */
class Logger {
  private context?: string;
  private winstonLogger: winston.Logger;

  constructor(context?: string) {
    this.context = context;
    this.winstonLogger = context
      ? winstonLogger.child({ context })
      : winstonLogger;
  }

  /**
   * Log error message
   */
  error(message: string, ...args: unknown[]): void {
    const meta = this.formatArgs(args);
    this.winstonLogger.error(message, scrubSensitiveData(meta));
  }

  /**
   * Log warning message
   */
  warn(message: string, ...args: unknown[]): void {
    const meta = this.formatArgs(args);
    this.winstonLogger.warn(message, scrubSensitiveData(meta));
  }

  /**
   * Log info message
   */
  info(message: string, ...args: unknown[]): void {
    const meta = this.formatArgs(args);
    this.winstonLogger.info(message, scrubSensitiveData(meta));
  }

  /**
   * Log debug message
   */
  debug(message: string, ...args: unknown[]): void {
    const meta = this.formatArgs(args);
    this.winstonLogger.debug(message, scrubSensitiveData(meta));
  }

  /**
   * Create a child logger with a context prefix
   */
  child(context: string): Logger {
    const childContext = this.context ? `${this.context}:${context}` : context;
    return new Logger(childContext);
  }

  /**
   * Log HTTP request (for Morgan integration)
   */
  httpRequest(message: string): void {
    this.winstonLogger.info(message, { type: 'http' });
  }

  /**
   * Log startup message
   */
  startup(message: string): void {
    this.winstonLogger.info(message, { type: 'startup' });
  }

  /**
   * Log separator line (no-op in production, visual in dev)
   */
  separator(): void {
    if (!isProduction) {
      console.log('─'.repeat(50));
    }
  }

  /**
   * Log object in formatted JSON
   */
  json(obj: unknown, level: 'debug' | 'info' | 'warn' | 'error' = 'debug'): void {
    this.winstonLogger[level]('Object dump', { data: obj });
  }

  /**
   * Log performance metric
   */
  performance(label: string, startTime: number): void {
    const duration = Date.now() - startTime;
    this.winstonLogger.debug(`${label} completed`, { duration_ms: duration, type: 'performance' });
  }

  /**
   * Format additional arguments into meta object
   */
  private formatArgs(args: unknown[]): Record<string, unknown> {
    if (args.length === 0) return {};
    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
      // If single object argument, spread it as meta
      const arg = args[0];
      if (arg instanceof Error) {
        return { error: { message: arg.message, stack: arg.stack } };
      }
      return arg as Record<string, unknown>;
    }
    // Multiple args or non-object single arg
    return { data: args };
  }
}

// Create and export the default logger instance
export const logger = new Logger();

// Export the Logger class for creating contextual loggers
export { Logger };

// Morgan stream for HTTP request logging
export const morganStream = {
  write: (message: string) => {
    logger.httpRequest(message.trim());
  },
};

// Export the underlying Winston logger for advanced use cases
export { winstonLogger };

