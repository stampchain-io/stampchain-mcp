/**
 * Logger module for the Stampchain MCP Server
 * Provides structured logging with multiple log levels and timestamp support
 */

/**
 * Log levels with their corresponding numeric priorities
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Mapping of log level names to their enum values
 */
const LOG_LEVEL_MAP: Record<string, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
};

/**
 * ANSI color codes for console output
 */
const COLORS = {
  DEBUG: '\x1b[36m', // Cyan
  INFO: '\x1b[32m', // Green
  WARN: '\x1b[33m', // Yellow
  ERROR: '\x1b[31m', // Red
  RESET: '\x1b[0m', // Reset
  BOLD: '\x1b[1m', // Bold
  DIM: '\x1b[2m', // Dim
} as const;

/**
 * Interface for log metadata
 */
export interface LogMetadata {
  [key: string]: unknown;
}

/**
 * Interface for performance timing data
 */
export interface PerformanceData {
  startTime?: number;
  duration?: number;
  operation?: string;
}

/**
 * Interface for logger configuration
 */
export interface LoggerConfig {
  level: LogLevel;
  useColors: boolean;
  enablePerformanceLogging: boolean;
  maxMetadataDepth: number;
}

/**
 * Logger class providing structured logging functionality
 */
export class Logger {
  private config: LoggerConfig;
  private name?: string;
  private performanceTimers: Map<string, number> = new Map();

  /**
   * Creates a new Logger instance
   * @param name - Optional name for the logger (e.g., module name)
   * @param config - Optional configuration override
   */
  constructor(name?: string, config?: Partial<LoggerConfig>) {
    this.name = name;
    this.config = {
      level: this.getLogLevelFromEnv(),
      useColors: process.env.NO_COLOR !== 'true',
      enablePerformanceLogging: process.env.NODE_ENV === 'development',
      maxMetadataDepth: 3,
      ...config,
    };
  }

  /**
   * Gets the log level from environment variable
   * @returns The configured log level
   */
  private getLogLevelFromEnv(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toLowerCase();
    if (envLevel && envLevel in LOG_LEVEL_MAP) {
      return LOG_LEVEL_MAP[envLevel];
    }
    return LogLevel.INFO; // Default to INFO level
  }

  /**
   * Formats timestamp for log output
   * @returns Formatted timestamp string
   */
  private formatTimestamp(): string {
    const now = new Date();
    const timestamp = now.toISOString();

    if (!this.config.useColors) {
      return timestamp;
    }

    return `${COLORS.DIM}${timestamp}${COLORS.RESET}`;
  }

  /**
   * Formats the log level for output
   * @param level - The log level
   * @returns Formatted level string with optional color
   */
  private formatLevel(level: LogLevel): string {
    const levelName = LogLevel[level];
    if (!this.config.useColors) {
      return `[${levelName}]`;
    }

    const color = COLORS[levelName as keyof typeof COLORS] || COLORS.RESET;
    return `${color}${COLORS.BOLD}[${levelName}]${COLORS.RESET}`;
  }

  /**
   * Formats metadata for log output with depth control
   * @param metadata - Optional metadata object
   * @returns Formatted metadata string
   */
  private formatMetadata(metadata?: LogMetadata): string {
    if (!metadata || Object.keys(metadata).length === 0) {
      return '';
    }

    try {
      // Sanitize and limit depth of metadata
      const sanitized = this.sanitizeMetadata(metadata, this.config.maxMetadataDepth);
      const formatted = JSON.stringify(sanitized, null, 2);

      if (!this.config.useColors) {
        return `\n${formatted}`;
      }

      return `\n${COLORS.DIM}${formatted}${COLORS.RESET}`;
    } catch (error) {
      return `\n[Error formatting metadata: ${error instanceof Error ? error.message : 'Unknown error'}]`;
    }
  }

  /**
   * Sanitizes metadata to prevent logging sensitive information
   * @param obj - Object to sanitize
   * @param maxDepth - Maximum depth to traverse
   * @returns Sanitized object
   */
  private sanitizeMetadata(obj: any, maxDepth: number): any {
    if (maxDepth <= 0) {
      return '[Max depth reached]';
    }

    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.slice(0, 10).map((item) => this.sanitizeMetadata(item, maxDepth - 1));
    }

    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth', 'credential', 'api_key'];
    const result: any = {};

    for (const [key, value] of Object.entries(obj)) {
      const keyLower = key.toLowerCase();

      if (sensitiveKeys.some((sensitive) => keyLower.includes(sensitive))) {
        result[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.sanitizeMetadata(value, maxDepth - 1);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Internal logging method
   * @param level - Log level
   * @param message - Log message
   * @param metadata - Optional metadata
   */
  private log(level: LogLevel, message: string, metadata?: LogMetadata): void {
    if (level < this.config.level) {
      return;
    }

    const timestamp = this.formatTimestamp();
    const levelStr = this.formatLevel(level);
    const nameStr = this.name ? ` ${COLORS.BOLD}[${this.name}]${COLORS.RESET}` : '';
    const metadataStr = this.formatMetadata(metadata);

    const formattedMessage = `${timestamp} ${levelStr}${nameStr} ${message}${metadataStr}`;

    switch (level) {
      case LogLevel.ERROR:
        console.error(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      default:
        // Using console.log for INFO and DEBUG to avoid ESLint no-console warnings
        // eslint-disable-next-line no-console
        console.log(formattedMessage);
    }
  }

  /**
   * Starts a performance timer
   * @param operationName - Name of the operation being timed
   */
  public startTimer(operationName: string): void {
    if (this.config.enablePerformanceLogging) {
      this.performanceTimers.set(operationName, Date.now());
    }
  }

  /**
   * Ends a performance timer and logs the duration
   * @param operationName - Name of the operation being timed
   * @param metadata - Optional additional metadata
   */
  public endTimer(operationName: string, metadata?: LogMetadata): void {
    if (!this.config.enablePerformanceLogging) {
      return;
    }

    const startTime = this.performanceTimers.get(operationName);
    if (startTime) {
      const duration = Date.now() - startTime;
      this.performanceTimers.delete(operationName);

      this.debug(`Performance: ${operationName} completed`, {
        duration: `${duration}ms`,
        operation: operationName,
        ...metadata,
      });
    }
  }

  /**
   * Logs a debug message
   * @param message - The message to log
   * @param metadata - Optional metadata
   */
  public debug(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  /**
   * Logs an info message
   * @param message - The message to log
   * @param metadata - Optional metadata
   */
  public info(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  /**
   * Logs a warning message
   * @param message - The message to log
   * @param metadata - Optional metadata
   */
  public warn(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  /**
   * Logs an error message
   * @param message - The message to log
   * @param metadata - Optional metadata
   */
  public error(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.ERROR, message, metadata);
  }

  /**
   * Logs with performance timing information
   * @param level - Log level
   * @param message - The message to log
   * @param operation - Operation name for timing
   * @param metadata - Optional metadata
   */
  public withTiming(
    level: LogLevel,
    message: string,
    operation: string,
    metadata?: LogMetadata
  ): void {
    const enhancedMetadata = {
      ...metadata,
      operation,
      timestamp: Date.now(),
    };

    this.log(level, message, enhancedMetadata);
  }

  /**
   * Gets the current log level
   * @returns The current log level
   */
  public getLevel(): LogLevel {
    return this.config.level;
  }

  /**
   * Sets the log level
   * @param level - The log level to set
   */
  public setLevel(level: LogLevel | string): void {
    if (typeof level === 'string') {
      const levelEnum = LOG_LEVEL_MAP[level.toLowerCase()];
      if (levelEnum !== undefined) {
        this.config.level = levelEnum;
      }
    } else {
      this.config.level = level;
    }
  }

  /**
   * Enables or disables performance logging
   * @param enabled - Whether to enable performance logging
   */
  public setPerformanceLogging(enabled: boolean): void {
    this.config.enablePerformanceLogging = enabled;
  }

  /**
   * Gets logger configuration
   * @returns Current logger configuration
   */
  public getConfig(): LoggerConfig {
    return { ...this.config };
  }
}

/**
 * Default logger instance for general use
 */
export const logger = new Logger();

/**
 * Creates a named logger instance
 * @param name - Name for the logger
 * @param config - Optional logger configuration
 * @returns A new Logger instance
 */
export function createLogger(name: string, config?: { level?: string | LogLevel }): Logger {
  const logger = new Logger(name);
  if (config?.level) {
    logger.setLevel(config.level);
  }
  return logger;
}

/**
 * Creates a logger with performance tracking enabled
 * @param name - Name for the logger
 * @param config - Optional logger configuration
 * @returns A new Logger instance with performance tracking
 */
export function createPerformanceLogger(
  name: string,
  config?: { level?: string | LogLevel }
): Logger {
  const logger = new Logger(name, { enablePerformanceLogging: true });
  if (config?.level) {
    logger.setLevel(config.level);
  }
  return logger;
}
