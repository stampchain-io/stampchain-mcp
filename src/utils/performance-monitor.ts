/**
 * Performance Monitor System
 * Provides strategic performance monitoring points throughout the MCP server
 */

import { EventEmitter } from 'events';
import { createLogger, type Logger } from './logger.js';

export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
  threshold?: number;
}

export interface PerformanceThreshold {
  metric: string;
  warning: number;
  critical: number;
  enabled: boolean;
}

export interface PerformanceAlert {
  metric: string;
  level: 'warning' | 'critical';
  value: number;
  threshold: number;
  timestamp: Date;
}

export interface PerformanceStats {
  totalMetrics: number;
  activeTimers: number;
  alertsTriggered: number;
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage?: NodeJS.CpuUsage;
}

export interface TimerMetadata {
  startTime: number;
  operation: string;
  context?: Record<string, any>;
}

/**
 * Performance monitoring system with strategic monitoring points
 */
export class PerformanceMonitor extends EventEmitter {
  private logger: Logger;
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private timers: Map<string, TimerMetadata> = new Map();
  private thresholds: Map<string, PerformanceThreshold> = new Map();
  private alerts: PerformanceAlert[] = [];
  private startTime: number = Date.now();
  private metricsRetentionMs: number = 5 * 60 * 1000; // 5 minutes
  private maxMetricsPerType: number = 1000;
  private cpuUsageBaseline?: NodeJS.CpuUsage;

  constructor(options: { logger?: Logger; retentionMs?: number; maxMetrics?: number } = {}) {
    super();
    this.logger = options.logger || createLogger('performance-monitor');
    this.metricsRetentionMs = options.retentionMs || this.metricsRetentionMs;
    this.maxMetricsPerType = options.maxMetrics || this.maxMetricsPerType;

    // Initialize CPU usage baseline
    this.cpuUsageBaseline = process.cpuUsage();

    // Setup default thresholds
    this.setupDefaultThresholds();

    // Start cleanup interval
    this.startCleanupInterval();

    this.logger.debug('Performance monitor initialized', {
      retentionMs: this.metricsRetentionMs,
      maxMetrics: this.maxMetricsPerType,
    });
  }

  /**
   * Start a performance timer
   */
  startTimer(operation: string, context?: Record<string, any>): string {
    const timerId = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.timers.set(timerId, {
      startTime: Date.now(),
      operation,
      context,
    });

    this.logger.debug('Started performance timer', {
      timerId,
      operation,
      context,
    });

    return timerId;
  }

  /**
   * End a performance timer and record metric
   */
  endTimer(timerId: string, additionalTags?: Record<string, string>): number | null {
    const timer = this.timers.get(timerId);
    if (!timer) {
      this.logger.warn('Timer not found', { timerId });
      return null;
    }

    const duration = Date.now() - timer.startTime;
    this.timers.delete(timerId);

    // Record the metric
    this.recordMetric(`${timer.operation}_duration`, duration, {
      operation: timer.operation,
      ...additionalTags,
    });

    this.logger.debug('Ended performance timer', {
      timerId,
      operation: timer.operation,
      duration: `${duration}ms`,
    });

    return duration;
  }

  /**
   * Record a performance metric
   */
  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: new Date(),
      tags,
      threshold: this.thresholds.get(name)?.warning,
    };

    // Get or create metrics array
    let metricsArray = this.metrics.get(name);
    if (!metricsArray) {
      metricsArray = [];
      this.metrics.set(name, metricsArray);
    }

    // Add metric
    metricsArray.push(metric);

    // Trim if too many metrics
    if (metricsArray.length > this.maxMetricsPerType) {
      metricsArray.shift();
    }

    // Check thresholds
    this.checkThresholds(metric);

    this.emit('metric', metric);
  }

  /**
   * Get metrics for a specific name
   */
  getMetrics(name: string): PerformanceMetric[] {
    return this.metrics.get(name) || [];
  }

  /**
   * Get all metric names
   */
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Get performance statistics
   */
  getStats(): PerformanceStats {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = this.cpuUsageBaseline ? process.cpuUsage(this.cpuUsageBaseline) : undefined;

    return {
      totalMetrics: Array.from(this.metrics.values()).reduce((sum, arr) => sum + arr.length, 0),
      activeTimers: this.timers.size,
      alertsTriggered: this.alerts.length,
      uptime: Date.now() - this.startTime,
      memoryUsage,
      cpuUsage,
    };
  }

  /**
   * Get recent alerts
   */
  getAlerts(limit: number = 10): PerformanceAlert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * Clear all metrics and alerts
   */
  clear(): void {
    this.metrics.clear();
    this.timers.clear();
    this.alerts.length = 0;
    this.logger.debug('Performance monitor cleared');
  }

  /**
   * Set performance threshold
   */
  setThreshold(metric: string, warning: number, critical: number, enabled: boolean = true): void {
    this.thresholds.set(metric, {
      metric,
      warning,
      critical,
      enabled,
    });

    this.logger.debug('Set performance threshold', {
      metric,
      warning,
      critical,
      enabled,
    });
  }

  /**
   * Strategic monitoring methods for key operations
   */

  /**
   * Monitor tool execution performance
   */
  monitorToolExecution<T>(
    toolName: string,
    operation: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T> {
    const timerId = this.startTimer(`tool_execution_${toolName}`, context);

    return operation()
      .then((result) => {
        this.endTimer(timerId, { toolName, status: 'success' });
        return result;
      })
      .catch((error) => {
        this.endTimer(timerId, { toolName, status: 'error', errorType: error.constructor.name });
        throw error;
      });
  }

  /**
   * Monitor API request performance
   */
  monitorAPIRequest<T>(
    endpoint: string,
    method: string,
    operation: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T> {
    const timerId = this.startTimer(`api_request_${method}_${endpoint}`, context);

    return operation()
      .then((result) => {
        this.endTimer(timerId, { endpoint, method, status: 'success' });
        return result;
      })
      .catch((error) => {
        this.endTimer(timerId, {
          endpoint,
          method,
          status: 'error',
          errorType: error.constructor.name,
        });
        throw error;
      });
  }

  /**
   * Monitor MCP protocol operation performance
   */
  monitorProtocolOperation<T>(
    operation: string,
    handler: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T> {
    const timerId = this.startTimer(`protocol_${operation}`, context);

    return handler()
      .then((result) => {
        this.endTimer(timerId, { operation, status: 'success' });
        return result;
      })
      .catch((error) => {
        this.endTimer(timerId, { operation, status: 'error', errorType: error.constructor.name });
        throw error;
      });
  }

  /**
   * Monitor memory usage
   */
  recordMemoryUsage(): void {
    const memoryUsage = process.memoryUsage();

    this.recordMetric('memory_heap_used', memoryUsage.heapUsed);
    this.recordMetric('memory_heap_total', memoryUsage.heapTotal);
    this.recordMetric('memory_rss', memoryUsage.rss);
    this.recordMetric('memory_external', memoryUsage.external);
  }

  /**
   * Monitor CPU usage
   */
  recordCPUUsage(): void {
    if (this.cpuUsageBaseline) {
      const cpuUsage = process.cpuUsage(this.cpuUsageBaseline);
      this.recordMetric('cpu_user', cpuUsage.user);
      this.recordMetric('cpu_system', cpuUsage.system);

      // Update baseline
      this.cpuUsageBaseline = process.cpuUsage();
    }
  }

  /**
   * Monitor connection metrics
   */
  recordConnectionMetric(type: 'connect' | 'disconnect' | 'active_count', value: number = 1): void {
    this.recordMetric(`connection_${type}`, value);
  }

  /**
   * Monitor request rate
   */
  recordRequestRate(method: string, status: 'success' | 'error' = 'success'): void {
    this.recordMetric(`request_rate_${method}`, 1, { method, status });
  }

  /**
   * Setup default performance thresholds
   */
  private setupDefaultThresholds(): void {
    // Tool execution thresholds (ms)
    this.setThreshold('tool_execution_analyze_stamp_code_duration', 5000, 10000);
    this.setThreshold('tool_execution_get_stamp_duration', 2000, 5000);
    this.setThreshold('tool_execution_search_stamps_duration', 3000, 8000);

    // API request thresholds (ms)
    this.setThreshold('api_request_GET_/stamps_duration', 1000, 3000);
    this.setThreshold('api_request_GET_/collections_duration', 1500, 4000);
    this.setThreshold('api_request_GET_/tokens_duration', 1000, 3000);

    // Protocol operation thresholds (ms)
    this.setThreshold('protocol_tools/call_duration', 1000, 5000);
    this.setThreshold('protocol_tools/list_duration', 100, 500);

    // Memory thresholds (bytes)
    this.setThreshold('memory_heap_used', 100 * 1024 * 1024, 200 * 1024 * 1024); // 100MB warning, 200MB critical
    this.setThreshold('memory_rss', 150 * 1024 * 1024, 300 * 1024 * 1024); // 150MB warning, 300MB critical

    // CPU thresholds (microseconds)
    this.setThreshold('cpu_user', 100000, 500000); // 100ms warning, 500ms critical
    this.setThreshold('cpu_system', 50000, 200000); // 50ms warning, 200ms critical

    // Connection thresholds
    this.setThreshold('connection_active_count', 10, 20);
  }

  /**
   * Check if metric exceeds thresholds
   */
  private checkThresholds(metric: PerformanceMetric): void {
    const threshold = this.thresholds.get(metric.name);
    if (!threshold || !threshold.enabled) {
      return;
    }

    let alertLevel: 'warning' | 'critical' | null = null;
    let thresholdValue: number | null = null;

    if (metric.value >= threshold.critical) {
      alertLevel = 'critical';
      thresholdValue = threshold.critical;
    } else if (metric.value >= threshold.warning) {
      alertLevel = 'warning';
      thresholdValue = threshold.warning;
    }

    if (alertLevel && thresholdValue !== null) {
      const alert: PerformanceAlert = {
        metric: metric.name,
        level: alertLevel,
        value: metric.value,
        threshold: thresholdValue,
        timestamp: new Date(),
      };

      this.alerts.push(alert);

      // Keep only last 100 alerts
      if (this.alerts.length > 100) {
        this.alerts.shift();
      }

      this.emit('alert', alert);

      this.logger.warn('Performance threshold exceeded', {
        metric: metric.name,
        level: alertLevel,
        value: metric.value,
        threshold: thresholdValue,
        tags: metric.tags,
      });
    }
  }

  /**
   * Start cleanup interval to remove old metrics
   */
  private startCleanupInterval(): void {
    const cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, 60000); // Clean up every minute

    // Clear interval on process exit
    process.on('exit', () => {
      clearInterval(cleanupInterval);
    });
  }

  /**
   * Clean up old metrics
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - this.metricsRetentionMs;
    let totalCleaned = 0;

    for (const [name, metrics] of this.metrics.entries()) {
      const originalLength = metrics.length;
      const filtered = metrics.filter((m) => m.timestamp.getTime() > cutoffTime);

      if (filtered.length !== originalLength) {
        this.metrics.set(name, filtered);
        totalCleaned += originalLength - filtered.length;
      }
    }

    if (totalCleaned > 0) {
      this.logger.debug('Cleaned up old metrics', {
        totalCleaned,
        retentionMs: this.metricsRetentionMs,
      });
    }
  }
}

/**
 * Global performance monitor instance
 */
export const globalPerformanceMonitor = new PerformanceMonitor();

/**
 * Decorator for monitoring method performance
 */
export function monitorPerformance(metricName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const finalMetricName = metricName || `${target.constructor.name}_${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const timerId = globalPerformanceMonitor.startTimer(finalMetricName, {
        className: target.constructor.name,
        methodName: propertyKey,
      });

      try {
        const result = await originalMethod.apply(this, args);
        globalPerformanceMonitor.endTimer(timerId, { status: 'success' });
        return result;
      } catch (error) {
        globalPerformanceMonitor.endTimer(timerId, {
          status: 'error',
          errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        });
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Utility function to create performance-aware wrapper
 */
export function withPerformanceMonitoring<T extends (...args: any[]) => Promise<any>>(
  operation: T,
  metricName: string,
  context?: Record<string, any>
): T {
  return (async (...args: any[]) => {
    const timerId = globalPerformanceMonitor.startTimer(metricName, context);

    try {
      const result = await operation(...args);
      globalPerformanceMonitor.endTimer(timerId, { status: 'success' });
      return result;
    } catch (error) {
      globalPerformanceMonitor.endTimer(timerId, {
        status: 'error',
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      });
      throw error;
    }
  }) as T;
}
