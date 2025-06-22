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
} as const;

/**
 * Interface for log metadata
 */
export interface LogMetadata {
  [key: string]: unknown;
}

/**
 * Interface for logger configuration
 */
export interface LoggerConfig {
  level: LogLevel;
  useColors: boolean;
}

/**
 * Logger class providing structured logging functionality
 */
export class Logger {
  private config: LoggerConfig;
  private name?: string;

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
   * Formats a timestamp for log output
   * @returns ISO timestamp string
   */
  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Formats metadata for log output
   * @param metadata - Optional metadata object
   * @returns Formatted metadata string
   */
  private formatMetadata(metadata?: LogMetadata): string {
    if (!metadata || Object.keys(metadata).length === 0) {
      return '';
    }
    return ' ' + JSON.stringify(metadata);
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
    return `${color}[${levelName}]${COLORS.RESET}`;
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
    const nameStr = this.name ? ` [${this.name}]` : '';
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
   * Creates a child logger with a specific name
   * @param name - Name for the child logger
   * @returns A new Logger instance
   */
  public child(name: string): Logger {
    const childName = this.name ? `${this.name}:${name}` : name;
    return new Logger(childName, this.config);
  }

  /**
   * Updates the logger configuration
   * @param config - Partial configuration to update
   */
  public setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
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
