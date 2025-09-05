import type { Histogram, Counter, UpDownCounter } from '@opentelemetry/api'
import { meter } from '../otel'

// Test execution metrics
export const testExecutionDuration: Histogram = meter.createHistogram('vitest_test_execution_duration_seconds', {
  description: 'Duration of test execution in seconds',
  unit: 's',
})

export const testExecutionCount: Counter = meter.createCounter('vitest_test_execution_total', {
  description: 'Total number of test executions',
})

export const testFailureCount: Counter = meter.createCounter('vitest_test_failures_total', {
  description: 'Total number of test failures',
})

export const testSuccessCount: Counter = meter.createCounter('vitest_test_successes_total', {
  description: 'Total number of test successes',
})

export const testSkippedCount: Counter = meter.createCounter('vitest_test_skipped_total', {
  description: 'Total number of skipped tests',
})

// File and suite metrics
export const testFilesProcessed: Counter = meter.createCounter('vitest_test_files_processed_total', {
  description: 'Total number of test files processed',
})

export const testSuitesExecuted: Counter = meter.createCounter('vitest_test_suites_executed_total', {
  description: 'Total number of test suites executed',
})

// Performance metrics
export const testFileTransformDuration: Histogram = meter.createHistogram('vitest_file_transform_duration_seconds', {
  description: 'Duration of test file transformation in seconds',
  unit: 's',
})

export const testCollectionDuration: Histogram = meter.createHistogram('vitest_test_collection_duration_seconds', {
  description: 'Duration of test collection in seconds',
  unit: 's',
})

export const testSetupDuration: Histogram = meter.createHistogram('vitest_test_setup_duration_seconds', {
  description: 'Duration of test setup in seconds',
  unit: 's',
})

// Coverage metrics
export const coveragePercentage: Histogram = meter.createHistogram('vitest_coverage_percentage', {
  description: 'Code coverage percentage',
  unit: '%',
})

export const coverageFilesCount: Counter = meter.createCounter('vitest_coverage_files_total', {
  description: 'Total number of files included in coverage',
})

// API and WebSocket metrics
export const apiRequestCount: Counter = meter.createCounter('vitest_api_requests_total', {
  description: 'Total number of API requests',
})

export const websocketConnectionsActive: UpDownCounter = meter.createUpDownCounter('vitest_websocket_connections_active', {
  description: 'Number of active WebSocket connections',
})

export const websocketMessagesCount: Counter = meter.createCounter('vitest_websocket_messages_total', {
  description: 'Total number of WebSocket messages',
})

// System metrics
export const memoryUsage: Histogram = meter.createHistogram('vitest_memory_usage_bytes', {
  description: 'Memory usage in bytes',
  unit: 'bytes',
})

export const cpuUsage: Histogram = meter.createHistogram('vitest_cpu_usage_percentage', {
  description: 'CPU usage percentage',
  unit: '%',
})

// Error metrics
export const errorCount: Counter = meter.createCounter('vitest_errors_total', {
  description: 'Total number of errors',
})

export const unhandledErrorCount: Counter = meter.createCounter('vitest_unhandled_errors_total', {
  description: 'Total number of unhandled errors',
})

// Watch mode metrics
export const watchModeRerunsCount: Counter = meter.createCounter('vitest_watch_mode_reruns_total', {
  description: 'Total number of watch mode reruns',
})

export const fileChangesDetected: Counter = meter.createCounter('vitest_file_changes_detected_total', {
  description: 'Total number of file changes detected',
})

// Helper functions for common metric patterns
export function recordTestExecution(
  duration: number,
  status: 'passed' | 'failed' | 'skipped',
  attributes: Record<string, string | number> = {},
): void {
  const baseAttributes = {
    status,
    ...attributes,
  }

  testExecutionDuration.record(duration, baseAttributes)
  testExecutionCount.add(1, baseAttributes)

  switch (status) {
    case 'passed':
      testSuccessCount.add(1, baseAttributes)
      break
    case 'failed':
      testFailureCount.add(1, baseAttributes)
      break
    case 'skipped':
      testSkippedCount.add(1, baseAttributes)
      break
  }
}

export function recordFileProcessing(
  filename: string,
  transformDuration?: number,
  attributes: Record<string, string | number> = {},
): void {
  const baseAttributes = {
    filename,
    ...attributes,
  }

  testFilesProcessed.add(1, baseAttributes)

  if (transformDuration !== undefined) {
    testFileTransformDuration.record(transformDuration, baseAttributes)
  }
}

export function recordApiRequest(
  method: string,
  endpoint: string,
  statusCode: number,
  duration?: number,
  attributes: Record<string, string | number> = {},
): void {
  const baseAttributes = {
    method,
    endpoint,
    status_code: statusCode,
    ...attributes,
  }

  apiRequestCount.add(1, baseAttributes)
}

export function recordWebSocketActivity(
  action: 'connect' | 'disconnect' | 'message',
  messageType?: string,
  attributes: Record<string, string | number> = {},
): void {
  const baseAttributes = {
    action,
    message_type: messageType || 'unknown',
    ...attributes,
  }

  switch (action) {
    case 'connect':
      websocketConnectionsActive.add(1, baseAttributes)
      break
    case 'disconnect':
      websocketConnectionsActive.add(-1, baseAttributes)
      break
    case 'message':
      websocketMessagesCount.add(1, baseAttributes)
      break
  }
}

export function recordSystemMetrics(): void {
  const memUsage = process.memoryUsage()

  memoryUsage.record(memUsage.heapUsed, { type: 'heap_used' })
  memoryUsage.record(memUsage.heapTotal, { type: 'heap_total' })
  memoryUsage.record(memUsage.rss, { type: 'rss' })
  memoryUsage.record(memUsage.external, { type: 'external' })

  // CPU usage would require additional monitoring, for now we'll skip it
  // as it requires more complex implementation
}

export function recordError(
  error: Error,
  type: 'handled' | 'unhandled' = 'handled',
  attributes: Record<string, string | number> = {},
): void {
  const baseAttributes = {
    error_name: error.name,
    error_type: type,
    ...attributes,
  }

  errorCount.add(1, baseAttributes)

  if (type === 'unhandled') {
    unhandledErrorCount.add(1, baseAttributes)
  }
}
