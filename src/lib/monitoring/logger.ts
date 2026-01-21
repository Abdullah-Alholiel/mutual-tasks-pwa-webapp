// ============================================================================
// Logger - Centralized Logging Service
// ============================================================================
// Provides environment-aware logging with log level control.
// Replaces all console.log/warn/error statements throughout the codebase.
//
// Features:
// - Environment-based filtering (development vs production)
// - Configurable log levels
// - Structured logging for debugging
// - Error tracking integration ready
// ============================================================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

interface LoggerOptions {
    level?: LogLevel;
    environment?: 'development' | 'production' | 'test';
    enableStackTrace?: boolean;
}

interface LogEntry {
    level: LogLevel;
    timestamp: string;
    message: string;
    data?: unknown[];
    context?: Record<string, unknown>;
}

class Logger {
    private level: LogLevel;
    private environment: string;
    private enableStackTrace: boolean;
    private history: LogEntry[] = [];
    private readonly MAX_HISTORY = 100;

    constructor(options: LoggerOptions = {}) {
        this.level = options.level ?? this.getLogLevelFromEnv();
        this.environment = options.environment ?? (import.meta.env.MODE || 'development');
        this.enableStackTrace = options.enableStackTrace ?? true;
    }

    private getLogLevelFromEnv(): LogLevel {
        const envLevel = import.meta.env.VITE_LOG_LEVEL as LogLevel;
        if (envLevel && ['debug', 'info', 'warn', 'error', 'none'].includes(envLevel)) {
            return envLevel;
        }
        return this.environment === 'production' ? 'warn' : 'debug';
    }

    private shouldLog(level: LogLevel): boolean {
        const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'none'];
        const currentLevelIndex = levels.indexOf(this.level);
        const messageLevelIndex = levels.indexOf(level);
        return messageLevelIndex >= currentLevelIndex;
    }

    private formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
        const emoji = {
            debug: '🔍',
            info: 'ℹ️',
            warn: '⚠️',
            error: '❌',
            none: ''
        }[level];

        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}] ${emoji}`;
        return `${prefix} ${message}`;
    }

    private addToHistory(level: LogLevel, message: string, data?: unknown[]): void {
        const entry: LogEntry = {
            level,
            timestamp: new Date().toISOString(),
            message,
            data,
        };

        this.history.push(entry);
        if (this.history.length > this.MAX_HISTORY) {
            this.history.shift();
        }
    }

    debug(message: string, ...args: unknown[]): void {
        if (!this.shouldLog('debug')) return;

        const formattedMessage = this.formatMessage('debug', message);
        console.log(formattedMessage, ...args);
        this.addToHistory('debug', message, args);
    }

    info(message: string, ...args: unknown[]): void {
        if (!this.shouldLog('info')) return;

        const formattedMessage = this.formatMessage('info', message);
        console.info(formattedMessage, ...args);
        this.addToHistory('info', message, args);
    }

    warn(message: string, ...args: unknown[]): void {
        if (!this.shouldLog('warn')) return;

        const formattedMessage = this.formatMessage('warn', message);
        console.warn(formattedMessage, ...args);
        this.addToHistory('warn', message, args);
    }

    error(message: string, error?: unknown, ...args: unknown[]): void {
        if (!this.shouldLog('error')) return;

        const formattedMessage = this.formatMessage('error', message);

        if (error instanceof Error) {
            console.error(formattedMessage, error, ...args);
            if (this.enableStackTrace) {
                console.error('Stack trace:', error.stack);
            }
        } else {
            console.error(formattedMessage, error, ...args);
        }

        this.addToHistory('error', message, [error, ...args]);

        // TODO: Send to error tracking service (Sentry, LogRocket, etc.)
        // if (this.environment === 'production') {
        //     this.sendToErrorTracking(message, error, args);
        // }
    }

    getHistory(): LogEntry[] {
        return [...this.history];
    }

    clearHistory(): void {
        this.history = [];
    }

    setLevel(level: LogLevel): void {
        this.level = level;
        this.info(`Logger level set to: ${level}`);
    }

    getLevel(): LogLevel {
        return this.level;
    }
}

// Global logger instance
export const logger = new Logger();

// Export logger methods for easy import
export const { debug, info, warn, error } = logger;

export default logger;
