import type { TestError } from '@vitest/utils'
import type { Task } from '@vitest/runner'
import type { Vitest } from '../core'
import type { TestProject } from '../project'

export interface ErrorContext {
  timestamp: number
  testFile?: string
  testName?: string
  projectName?: string
  pool?: string
  environment?: string
  stackTrace?: string
  errorType: string
  category: ErrorCategory
  severity: ErrorSeverity
  metadata?: Record<string, any>
  performance?: PerformanceMetrics
}

export interface PerformanceMetrics {
  duration: number
  memoryUsage: NodeJS.MemoryUsage
  timestamp: number
}

export enum ErrorCategory {
  TEST_FAILURE = 'test_failure',
  CONFIGURATION = 'configuration',
  COMPILATION = 'compilation',
  TIMEOUT = 'timeout',
  MEMORY = 'memory',
  NETWORK = 'network',
  FILE_SYSTEM = 'file_system',
  PLUGIN = 'plugin',
  ASSERTION = 'assertion',
  MOCK = 'mock',
  COVERAGE = 'coverage',
  BROWSER = 'browser',
  UNKNOWN = 'unknown'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorPattern {
  pattern: RegExp
  category: ErrorCategory
  severity: ErrorSeverity
  description: string
}

export class ErrorInstrumentation {
  private static instance: ErrorInstrumentation | null = null
  private errors: ErrorContext[] = []
  private startTime: number
  private performanceMarks: Map<string, number> = new Map()
  private errorPatterns: ErrorPattern[] = []
  private enabled = false

  constructor(private ctx: Vitest) {
    this.startTime = Date.now()
    this.setupErrorPatterns()
    this.setupProcessHandlers()
  }

  public static getInstance(ctx: Vitest): ErrorInstrumentation {
    if (!ErrorInstrumentation.instance) {
      ErrorInstrumentation.instance = new ErrorInstrumentation(ctx)
    }
    return ErrorInstrumentation.instance
  }

  public enable(): void {
    this.enabled = true
    this.ctx.logger.log('✓ Error instrumentation enabled')
  }

  public disable(): void {
    this.enabled = false
    this.ctx.logger.log('⚠ Error instrumentation disabled')
  }

  private setupErrorPatterns(): void {
    this.errorPatterns = [
      {
        pattern: /AssertionError|expect.*toBe|expect.*toEqual/i,
        category: ErrorCategory.ASSERTION,
        severity: ErrorSeverity.MEDIUM,
        description: 'Test assertion failure'
      },
      {
        pattern: /timeout|timed out/i,
        category: ErrorCategory.TIMEOUT,
        severity: ErrorSeverity.HIGH,
        description: 'Test or operation timeout'
      },
      {
        pattern: /out of memory|heap|memory/i,
        category: ErrorCategory.MEMORY,
        severity: ErrorSeverity.CRITICAL,
        description: 'Memory-related error'
      },
      {
        pattern: /ENOENT|EACCES|EMFILE|file not found/i,
        category: ErrorCategory.FILE_SYSTEM,
        severity: ErrorSeverity.MEDIUM,
        description: 'File system error'
      },
      {
        pattern: /fetch|XMLHttpRequest|network|connection/i,
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.MEDIUM,
        description: 'Network-related error'
      },
      {
        pattern: /mock|spy|stub/i,
        category: ErrorCategory.MOCK,
        severity: ErrorSeverity.MEDIUM,
        description: 'Mocking-related error'
      },
      {
        pattern: /coverage|istanbul|v8/i,
        category: ErrorCategory.COVERAGE,
        severity: ErrorSeverity.LOW,
        description: 'Code coverage error'
      },
      {
        pattern: /browser|playwright|webdriver|chrome|firefox|safari/i,
        category: ErrorCategory.BROWSER,
        severity: ErrorSeverity.HIGH,
        description: 'Browser testing error'
      },
      {
        pattern: /plugin|transform|rollup|vite/i,
        category: ErrorCategory.PLUGIN,
        severity: ErrorSeverity.HIGH,
        description: 'Plugin or transformation error'
      },
      {
        pattern: /config|configuration|setup/i,
        category: ErrorCategory.CONFIGURATION,
        severity: ErrorSeverity.HIGH,
        description: 'Configuration error'
      },
      {
        pattern: /compile|syntax|parse|unexpected token/i,
        category: ErrorCategory.COMPILATION,
        severity: ErrorSeverity.HIGH,
        description: 'Compilation or syntax error'
      }
    ]
  }

  private setupProcessHandlers(): void {
    // Track unhandled rejections
    const unhandledRejectionHandler = (reason: any, promise: Promise<any>) => {
      this.trackError(reason, {
        errorType: 'UnhandledRejection',
        category: ErrorCategory.UNKNOWN,
        severity: ErrorSeverity.CRITICAL,
        metadata: { promise: promise.toString() }
      })
    }

    // Track uncaught exceptions
    const uncaughtExceptionHandler = (error: Error) => {
      this.trackError(error, {
        errorType: 'UncaughtException',
        category: ErrorCategory.UNKNOWN,
        severity: ErrorSeverity.CRITICAL
      })
    }

    // Track warnings
    const warningHandler = (warning: Error) => {
      this.trackError(warning, {
        errorType: 'Warning',
        category: ErrorCategory.UNKNOWN,
        severity: ErrorSeverity.LOW
      })
    }

    if (typeof process !== 'undefined') {
      process.on('unhandledRejection', unhandledRejectionHandler)
      process.on('uncaughtException', uncaughtExceptionHandler)
      process.on('warning', warningHandler)
      
      // Cleanup on close
      this.ctx.onClose(() => {
        process.off('unhandledRejection', unhandledRejectionHandler)
        process.off('uncaughtException', uncaughtExceptionHandler)
        process.off('warning', warningHandler)
      })
    }
  }

  public markStart(label: string): void {
    if (!this.enabled) return
    this.performanceMarks.set(label, performance.now())
  }

  public markEnd(label: string): number | null {
    if (!this.enabled) return null
    const start = this.performanceMarks.get(label)
    if (start) {
      const duration = performance.now() - start
      this.performanceMarks.delete(label)
      return duration
    }
    return null
  }

  public trackError(
    error: unknown,
    context: Partial<ErrorContext> = {},
    task?: Task,
    project?: TestProject
  ): void {
    if (!this.enabled) return

    const errorObj = this.normalizeError(error)
    const category = this.categorizeError(errorObj)
    const severity = this.determineSeverity(errorObj, category)
    const performance = this.getPerformanceMetrics()

    const errorContext: ErrorContext = {
      timestamp: Date.now(),
      testFile: task?.file?.filepath || context.testFile,
      testName: task?.name || context.testName,
      projectName: project?.name || context.projectName,
      pool: task?.file?.pool || context.pool,
      environment: project?.config.environment || context.environment,
      stackTrace: errorObj.stack,
      errorType: errorObj.name || 'Unknown',
      category,
      severity,
      metadata: {
        message: errorObj.message,
        ...context.metadata
      },
      performance,
      ...context
    }

    this.errors.push(errorContext)
    this.logError(errorContext)
    this.reportCriticalError(errorContext)
  }

  private normalizeError(error: unknown): TestError {
    if (error instanceof Error) {
      return error as TestError
    }
    if (typeof error === 'string') {
      return new Error(error) as TestError
    }
    if (typeof error === 'object' && error !== null) {
      const err = new Error('Unknown error') as TestError
      Object.assign(err, error)
      return err
    }
    return new Error('Unknown error type') as TestError
  }

  private categorizeError(error: TestError): ErrorCategory {
    const errorText = `${error.name} ${error.message} ${error.stack}`.toLowerCase()
    
    for (const pattern of this.errorPatterns) {
      if (pattern.pattern.test(errorText)) {
        return pattern.category
      }
    }
    
    return ErrorCategory.UNKNOWN
  }

  private determineSeverity(error: TestError, category: ErrorCategory): ErrorSeverity {
    // Check for critical patterns first
    if (error.message?.includes('FATAL') || error.name === 'FatalError') {
      return ErrorSeverity.CRITICAL
    }

    // Use category-based severity
    const pattern = this.errorPatterns.find(p => p.category === category)
    return pattern?.severity || ErrorSeverity.MEDIUM
  }

  private getPerformanceMetrics(): PerformanceMetrics {
    const memUsage = typeof process !== 'undefined' ? process.memoryUsage() : {
      rss: 0,
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
      arrayBuffers: 0
    }
    
    return {
      duration: Date.now() - this.startTime,
      memoryUsage: memUsage,
      timestamp: Date.now()
    }
  }

  private logError(errorContext: ErrorContext): void {
    // Use Vitest's existing logger
    const logMessage = `[ERROR-TRACKER] ${errorContext.severity.toUpperCase()} | ${errorContext.category} | ${errorContext.errorType}`
    if (errorContext.testFile) {
      this.ctx.logger.error(`${logMessage} in ${errorContext.testFile}`)
    } else {
      this.ctx.logger.error(logMessage)
    }
    
    if (errorContext.metadata?.message) {
      this.ctx.logger.error(`  Message: ${errorContext.metadata.message}`)
    }
  }

  private reportCriticalError(errorContext: ErrorContext): void {
    if (errorContext.severity === ErrorSeverity.CRITICAL) {
      this.ctx.logger.error(`🚨 CRITICAL ERROR DETECTED`)
      this.ctx.logger.error(`Category: ${errorContext.category}`)
      this.ctx.logger.error(`Type: ${errorContext.errorType}`)
      if (errorContext.testFile) {
        this.ctx.logger.error(`File: ${errorContext.testFile}`)
      }
      if (errorContext.testName) {
        this.ctx.logger.error(`Test: ${errorContext.testName}`)
      }
    }
  }

  public getErrorSummary(): {
    total: number
    byCategory: Record<string, number>
    bySeverity: Record<string, number>
    recentErrors: ErrorContext[]
  } {
    const byCategory: Record<string, number> = {}
    const bySeverity: Record<string, number> = {}

    for (const error of this.errors) {
      byCategory[error.category] = (byCategory[error.category] || 0) + 1
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1
    }

    return {
      total: this.errors.length,
      byCategory,
      bySeverity,
      recentErrors: this.errors.slice(-10) // Last 10 errors
    }
  }

  public printSummary(): void {
    if (!this.enabled) {
      this.ctx.logger.log('Error instrumentation is disabled')
      return
    }

    const summary = this.getErrorSummary()
    
    this.ctx.logger.log('\n📊 Error Instrumentation Summary')
    this.ctx.logger.log(`Total Errors Tracked: ${summary.total}`)
    
    if (summary.total > 0) {
      this.ctx.logger.log('\nBy Category:')
      for (const [category, count] of Object.entries(summary.byCategory)) {
        this.ctx.logger.log(`  ${category}: ${count}`)
      }
      
      this.ctx.logger.log('\nBy Severity:')
      for (const [severity, count] of Object.entries(summary.bySeverity)) {
        this.ctx.logger.log(`  ${severity}: ${count}`)
      }
    }
  }

  public exportMetrics(): string {
    const metrics = {
      session: {
        startTime: this.startTime,
        endTime: Date.now(),
        duration: Date.now() - this.startTime
      },
      errors: this.getErrorSummary(),
      performance: this.getPerformanceMetrics(),
      details: this.errors
    }

    const jsonData = JSON.stringify(metrics, null, 2)
    this.ctx.logger.log(`📈 Metrics available:`)
    this.ctx.logger.log(jsonData.slice(0, 500) + (jsonData.length > 500 ? '...' : ''))
    return jsonData
  }

  public reset(): void {
    this.errors = []
    this.performanceMarks.clear()
    this.startTime = Date.now()
  }
}