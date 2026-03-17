import winston from 'winston';
import { env, isProduction } from './env.js';

// ── Level icons for dev readability ──────────────────────────────────
const LEVEL_ICONS: Record<string, string> = {
  error: '✗',
  warn: '⚠',
  info: '●',
  debug: '○',
};

// Custom format for development (pretty, colored, no service noise)
const devFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, context, service: _s, ...meta }) => {
    const icon = LEVEL_ICONS[level.replace(/\u001b\[\d+m/g, '')] || '·';
    const ctx = context ? `[${context}] ` : '';
    // Only show meta if there are keys beyond the default ones
    const metaKeys = Object.keys(meta);
    const metaStr = metaKeys.length > 0 ? `  ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level} ${icon} ${ctx}${message}${metaStr}`;
  })
);

// Custom format for production (structured JSON with full context)
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
   * Log HTTP request with structured data (replaces morgan stream)
   */
  httpRequest(message: string): void {
    this.winstonLogger.info(message, { type: 'http' });
  }

  /**
   * Log HTTP request with structured fields for production correlation
   */
  http(meta: { method: string; url: string; status: number; duration: number; ip?: string; requestId?: string }): void {
    const msg = `${meta.method} ${meta.url} ${meta.status} ${meta.duration}ms`;
    this.winstonLogger.info(msg, { type: 'http', ...meta });
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
   * Format additional arguments into meta object.
   * Handles Error instances, Supabase/Postgres error shapes, and plain objects.
   */
  private formatArgs(args: unknown[]): Record<string, unknown> {
    if (args.length === 0) return {};

    if (args.length === 1) {
      const arg = args[0];
      if (arg instanceof Error) {
        return {
          error: arg.message,
          stack: arg.stack,
          ...(('code' in arg) ? { code: (arg as any).code } : {}),
        };
      }
      if (typeof arg === 'object' && arg !== null) {
        // Supabase/PostgREST error shape: { message, code, details, hint }
        const a = arg as Record<string, unknown>;
        if ('code' in a && 'message' in a) {
          return {
            error: a.message,
            code: a.code,
            ...(a.details ? { details: a.details } : {}),
            ...(a.hint ? { hint: a.hint } : {}),
          };
        }
        return a;
      }
      return { data: arg };
    }

    // Multiple args — first Error wins, rest as data
    const result: Record<string, unknown> = {};
    const extras: unknown[] = [];
    for (const arg of args) {
      if (arg instanceof Error && !result.error) {
        result.error = arg.message;
        result.stack = arg.stack;
      } else {
        extras.push(arg);
      }
    }
    if (extras.length === 1 && typeof extras[0] === 'object' && extras[0] !== null) {
      Object.assign(result, extras[0]);
    } else if (extras.length > 0) {
      result.data = extras;
    }
    return result;
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

