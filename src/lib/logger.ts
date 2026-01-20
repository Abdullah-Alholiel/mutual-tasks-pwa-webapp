/**
 * Centralized logger utility
 * Provides production-safe logging with environment-based filtering
 */

const isDev = import.meta.env.DEV;
const isTest = import.meta.env.MODE === 'test';

type LogLevel = 'log' | 'warn' | 'error' | 'info' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown[];
  timestamp: Date;
}

const logBuffer: LogEntry[] = [];
const MAX_BUFFER_SIZE = 100;

/**
 * Format log message with timestamp and level
 */
const formatLogEntry = (level: LogLevel, message: string, data?: unknown[]): string => {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  const dataString = data && data.length > 0 ? ` ${JSON.stringify(data)}` : '';
  return `${prefix} ${message}${dataString}`;
};

/**
 * Core logging function
 */
const log = (level: LogLevel, message: string, ...data: unknown[]) => {
  // In production, only log errors and warnings
  if (!isDev && !isTest && level !== 'error' && level !== 'warn') {
    return;
  }

  const entry: LogEntry = {
    level,
    message,
    data: data.length > 0 ? data : undefined,
    timestamp: new Date(),
  };

  // Add to buffer
  logBuffer.push(entry);
  if (logBuffer.length > MAX_BUFFER_SIZE) {
    logBuffer.shift();
  }

  // Console output
  const formatted = formatLogEntry(level, message, data);

  switch (level) {
    case 'error':
      console.error(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'info':
      if (isDev || isTest) {
        console.info(formatted);
      }
      break;
    case 'debug':
      if (isDev || isTest) {
        console.debug(formatted);
      }
      break;
    case 'log':
    default:
      if (isDev || isTest) {
        console.log(formatted);
      }
      break;
  }
};

/**
 * Logger interface
 */
export const logger = {
  /**
   * Log general information (dev/test only)
   */
  log: (message: string, ...data: unknown[]) => {
    log('log', message, ...data);
  },

  /**
   * Log informational messages
   */
  info: (message: string, ...data: unknown[]) => {
    log('info', message, ...data);
  },

  /**
   * Log warnings
   */
  warn: (message: string, ...data: unknown[]) => {
    log('warn', message, ...data);
  },

  /**
   * Log errors
   */
  error: (message: string, ...data: unknown[]) => {
    log('error', message, ...data);
  },

  /**
   * Log debug information (dev/test only)
   */
  debug: (message: string, ...data: unknown[]) => {
    log('debug', message, ...data);
  },

  /**
   * Get buffered logs for error reporting
   */
  getLogs: (): LogEntry[] => {
    return [...logBuffer];
  },

  /**
   * Clear log buffer
   */
  clearLogs: () => {
    logBuffer.length = 0;
  },

  /**
   * Export logs as JSON (for error reporting)
   */
  exportLogs: (): string => {
    return JSON.stringify(logBuffer, null, 2);
  },
};

/**
 * Convenience export for backward compatibility
 * These should be replaced with logger methods in existing code
 */
export const devLog = logger.log;
export const devError = logger.error;
export const devWarn = logger.warn;
