/**
 * Streaming diagnostics and metrics collection for troubleshooting streaming performance.
 *
 * This module tracks buffer sizes, flush intervals, latency, and other metrics
 * to help identify streaming bottlenecks and measure fix effectiveness.
 */

export interface StreamingMetrics {
  /** Total number of chunks processed */
  totalChunks: number;
  /** Average chunk size in bytes */
  avgChunkSize: number;
  /** Maximum buffer size encountered */
  maxBufferSize: number;
  /** Average time between flushes in milliseconds */
  avgFlushInterval: number;
  /** End-to-end latency from first chunk to last in milliseconds */
  endToEndLatency: number;
  /** Number of forced flushes (due to timeout or buffer size) */
  forcedFlushes: number;
  /** Number of line-based flushes (complete lines) */
  lineFlushes: number;
  /** Session start time */
  sessionStart: number;
  /** Last activity timestamp */
  lastActivity: number;
}

export class StreamingDiagnostics {
  private startTime = Date.now();
  private chunkSizes: number[] = [];
  private flushTimes: number[] = [];
  private maxBuffer = 0;
  private forcedFlushCount = 0;
  private lineFlushCount = 0;
  private lastFlushTime = Date.now();

  /**
   * Record a received chunk size
   */
  recordChunk(size: number): void {
    this.chunkSizes.push(size);
  }

  /**
   * Record a buffer flush event
   */
  recordFlush(bufferSize: number, forced = false): void {
    const now = Date.now();
    this.flushTimes.push(now - this.lastFlushTime);
    this.lastFlushTime = now;

    this.maxBuffer = Math.max(this.maxBuffer, bufferSize);

    if (forced) {
      this.forcedFlushCount++;
    } else {
      this.lineFlushCount++;
    }
  }

  /**
   * Get comprehensive streaming metrics
   */
  getMetrics(): StreamingMetrics {
    const now = Date.now();

    return {
      totalChunks: this.chunkSizes.length,
      avgChunkSize: this.chunkSizes.length > 0
        ? this.chunkSizes.reduce((a, b) => a + b, 0) / this.chunkSizes.length
        : 0,
      maxBufferSize: this.maxBuffer,
      avgFlushInterval: this.flushTimes.length > 0
        ? this.flushTimes.reduce((a, b) => a + b, 0) / this.flushTimes.length
        : 0,
      endToEndLatency: now - this.startTime,
      forcedFlushes: this.forcedFlushCount,
      lineFlushes: this.lineFlushCount,
      sessionStart: this.startTime,
      lastActivity: now,
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.startTime = Date.now();
    this.chunkSizes = [];
    this.flushTimes = [];
    this.maxBuffer = 0;
    this.forcedFlushCount = 0;
    this.lineFlushCount = 0;
    this.lastFlushTime = Date.now();
  }

  /**
   * Check if streaming is healthy based on metrics
   */
  isHealthy(): boolean {
    const metrics = this.getMetrics();

    // Consider streaming unhealthy if:
    // - Average flush interval is too high (> 500ms)
    // - Buffer size is growing too large (> 10KB)
    // - Too many forced flushes relative to line flushes (> 50%)
    const avgInterval = metrics.avgFlushInterval;
    const bufferSize = metrics.maxBufferSize;
    const forcedRatio = metrics.totalChunks > 0
      ? metrics.forcedFlushes / (metrics.forcedFlushes + metrics.lineFlushes)
      : 0;

    return avgInterval < 500 && bufferSize < 10240 && forcedRatio < 0.5;
  }
}

// Global diagnostics instance for easy access
let globalDiagnostics: StreamingDiagnostics | null = null;

/**
 * Get or create the global diagnostics instance
 */
export function getGlobalDiagnostics(): StreamingDiagnostics {
  if (!globalDiagnostics) {
    globalDiagnostics = new StreamingDiagnostics();
  }
  return globalDiagnostics;
}

/**
 * Reset global diagnostics
 */
export function resetGlobalDiagnostics(): void {
  globalDiagnostics = new StreamingDiagnostics();
}
