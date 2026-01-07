import { env } from '../config/env.js';

// Log levels with priority
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

// ANSI color codes
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
} as const;

// Log level colors
const LEVEL_COLORS: Record<LogLevel, string> = {
  error: COLORS.red,
  warn: COLORS.yellow,
  info: COLORS.blue,
  debug: COLORS.gray,
};

/**
 * Format timestamp for logs
 */
const formatTimestamp = (): string => {
  return new Date().toISOString();
};

/**
 * Format log message
 */
const formatMessage = (
  level: LogLevel,
  message: string,
  ...args: unknown[]
): string => {
  const timestamp = formatTimestamp();
  const color = LEVEL_COLORS[level];
  const formattedArgs = args.length > 0 ? ` ${JSON.stringify(args)}` : '';
  
  return `${COLORS.gray}[${timestamp}]${COLORS.reset} ${color} ${level.toUpperCase()}${COLORS.reset}: ${message}${formattedArgs}`;
};

/**
 * Check if log level should be displayed
 */
const shouldLog = (level: LogLevel): boolean => {
  const configLevel = env.LOG_LEVEL as LogLevel;
  return LOG_LEVELS[level] <= LOG_LEVELS[configLevel];
};

/**
 * Logger class
 */
class Logger {
  private context?: string;

  constructor(context?: string) {
    this.context = context;
  }

  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!shouldLog(level)) return;

    const contextPrefix = this.context ? `[${this.context}] ` : '';
    const formattedMessage = formatMessage(level, `${contextPrefix}${message}`, ...args);

    switch (level) {
      case 'error':
        console.error(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      default:
        console.log(formattedMessage);
    }
  }

  /**
   * Log error message
   */
  error(message: string, ...args: unknown[]): void {
    this.log('error', message, ...args);
  }

  /**
   * Log warning message
   */
  warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, ...args);
  }

  /**
   * Log info message
   */
  info(message: string, ...args: unknown[]): void {
    this.log('info', message, ...args);
  }

  /**
   * Log debug message
   */
  debug(message: string, ...args: unknown[]): void {
    this.log('debug', message, ...args);
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
    if (shouldLog('info')) {
      console.log(`${COLORS.cyan}→${COLORS.reset} ${message}`);
    }
  }

  /**
   * Log startup message
   */
  startup(message: string): void {
    console.log(`${COLORS.green}🚀 ${message}${COLORS.reset}`);
  }

  /**
   * Log separator line
   */
  separator(): void {
    console.log(`${COLORS.gray}${'─'.repeat(50)}${COLORS.reset}`);
  }

  /**
   * Log object in formatted JSON
   */
  json(obj: unknown, level: LogLevel = 'debug'): void {
    if (!shouldLog(level)) return;
    console.log(JSON.stringify(obj, null, 2));
  }

  /**
   * Log performance metric
   */
  performance(label: string, startTime: number): void {
    const duration = Date.now() - startTime;
    this.debug(`${label} completed in ${duration}ms`);
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
