# Error Instrumentation in Vitest

The Error Instrumentation feature in Vitest provides comprehensive error tracking, categorization, and analysis capabilities to help you better understand and debug test failures.

## Overview

Error Instrumentation automatically:
- 🔍 **Tracks all errors** during test execution
- 🏷️ **Categorizes errors** by type and severity
- 📊 **Collects performance metrics** alongside error data
- 🚨 **Alerts on critical errors** in real-time
- 📈 **Exports detailed metrics** for analysis
- 🎯 **Provides actionable insights** for debugging

## Features

### Error Categories

Errors are automatically categorized into:

- **`test_failure`** - Standard test assertion failures
- **`assertion`** - Specific assertion errors (expect.toBe, etc.)
- **`timeout`** - Test timeouts and time-related failures
- **`memory`** - Memory-related errors and out-of-memory issues
- **`network`** - Network requests and connectivity errors
- **`file_system`** - File access and permission errors
- **`compilation`** - Syntax errors and compilation issues
- **`configuration`** - Setup and configuration problems
- **`plugin`** - Vite plugin and transformation errors
- **`mock`** - Mocking and spying related errors
- **`coverage`** - Code coverage collection errors
- **`browser`** - Browser testing specific errors
- **`unknown`** - Unclassified errors

### Severity Levels

Each error is assigned a severity level:

- **`critical`** 🚨 - Fatal errors that stop execution
- **`high`** ⚠️ - Errors that significantly impact testing
- **`medium`** ⚡ - Standard test failures and common issues
- **`low`** 💡 - Warnings and minor issues

## Usage

### Environment Variable

Enable error instrumentation globally:

```bash
VITEST_ERROR_INSTRUMENTATION=true npx vitest
```

### Programmatic API

```javascript
import { startVitest } from 'vitest'

const vitest = await startVitest('test', [], {
  // your config
})

// Enable error instrumentation
vitest.errorInstrumentation.enable()

// Track custom errors
vitest.errorInstrumentation.trackError(
  new Error('Custom error'),
  {
    errorType: 'CustomError',
    testFile: 'my-test.spec.js',
    testName: 'should work correctly'
  }
)

// Performance tracking
vitest.errorInstrumentation.markStart('my-operation')
// ... do something
const duration = vitest.errorInstrumentation.markEnd('my-operation')

// Get summary
const summary = vitest.errorInstrumentation.getErrorSummary()
console.log(`Total errors: ${summary.total}`)

// Export metrics
const metrics = vitest.errorInstrumentation.exportMetrics()
```

### Configuration Options

```javascript
// vitest.config.js
export default {
  test: {
    // Enable error instrumentation in config
    errorInstrumentation: true,
    
    // Custom error handlers can access instrumentation
    onUnhandledError: (error, { vitest }) => {
      vitest.errorInstrumentation.trackError(error, {
        errorType: 'UnhandledError',
        severity: 'critical'
      })
    }
  }
}
```

## API Reference

### ErrorInstrumentation Class

#### Methods

##### `enable()`
Enables error tracking and instrumentation.

##### `disable()`
Disables error tracking.

##### `trackError(error, context?, task?, project?)`
Manually track an error with additional context.

**Parameters:**
- `error` - The error object or message
- `context` - Additional context information
- `task` - Associated test task (optional)
- `project` - Associated test project (optional)

##### `markStart(label)`
Start a performance measurement.

##### `markEnd(label)`
End a performance measurement and return duration.

##### `getErrorSummary()`
Get a summary of all tracked errors.

**Returns:**
```javascript
{
  total: number,
  byCategory: Record<string, number>,
  bySeverity: Record<string, number>,
  recentErrors: ErrorContext[]
}
```

##### `printSummary()`
Print a formatted summary to the console.

##### `exportMetrics()`
Export all metrics as JSON string.

##### `reset()`
Clear all tracked errors and reset counters.

### Error Context Interface

```typescript
interface ErrorContext {
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
```

## Integration Examples

### CI/CD Pipeline

```yaml
# GitHub Actions example
- name: Run tests with error tracking
  run: |
    VITEST_ERROR_INSTRUMENTATION=true npm test
    # Process error metrics for analysis
```

### Custom Reporter

```javascript
// custom-error-reporter.js
export default class ErrorReporter {
  onInit(ctx) {
    this.vitest = ctx
    ctx.errorInstrumentation.enable()
  }
  
  onFinished() {
    const summary = this.vitest.errorInstrumentation.getErrorSummary()
    
    // Send to monitoring service
    if (summary.bySeverity.critical > 0) {
      this.alertCriticalErrors(summary)
    }
    
    // Save metrics for trending
    this.saveMetrics(summary)
  }
  
  alertCriticalErrors(summary) {
    // Send alert to Slack, email, etc.
  }
  
  saveMetrics(summary) {
    // Save to database, file, etc.
  }
}
```

### Development Workflow

```javascript
// vitest.config.js
export default {
  test: {
    setupFiles: ['./test-setup.js']
  }
}

// test-setup.js
import { beforeAll, afterAll } from 'vitest'

beforeAll(async (context) => {
  if (process.env.NODE_ENV === 'development') {
    context.vitest.errorInstrumentation.enable()
  }
})

afterAll(async (context) => {
  if (process.env.NODE_ENV === 'development') {
    context.vitest.errorInstrumentation.printSummary()
  }
})
```

## Use Cases

### 1. **Debugging Test Suites**
- Identify patterns in test failures
- Track down intermittent issues
- Understand error distribution across files

### 2. **Performance Monitoring**
- Monitor test execution performance
- Track memory usage patterns
- Identify performance regressions

### 3. **Quality Assurance**
- Set up alerts for critical errors
- Track error trends over time
- Generate quality reports

### 4. **Development Insights**
- Understand common failure modes
- Prioritize test fixes by severity
- Improve test reliability

### 5. **CI/CD Optimization**
- Track build failure patterns
- Optimize test execution order
- Reduce flaky test impact

## Best Practices

### When to Enable

✅ **Enable for:**
- Development debugging sessions
- CI/CD quality monitoring
- Performance analysis
- Long-running test suites

❌ **Avoid for:**
- Production builds (minimal overhead but unnecessary)
- Quick test runs where performance is critical
- When disk space is extremely limited

### Performance Considerations

Error instrumentation has minimal overhead:
- ~1-2ms per tracked error
- Memory usage scales with error count
- No impact when disabled

### Data Management

- **Metrics Export**: Export metrics periodically to avoid memory buildup
- **Log Rotation**: Clear old error data in long-running processes
- **Storage**: Consider storage requirements for metric files

## Troubleshooting

### Common Issues

**Error instrumentation not working:**
```javascript
// Ensure it's enabled
vitest.errorInstrumentation.enable()

// Check if errors are being tracked
console.log(vitest.errorInstrumentation.getErrorSummary())
```

**Missing error context:**
```javascript
// Provide more context when tracking manually
vitest.errorInstrumentation.trackError(error, {
  testFile: import.meta.url,
  testName: 'current test name',
  metadata: { additionalInfo: 'useful context' }
})
```

**Performance impact:**
```javascript
// Check if instrumentation is causing issues
vitest.errorInstrumentation.disable()
// Run tests and compare performance
```

## Contributing

The error instrumentation feature is designed to be extensible. You can:

1. **Add new error patterns** in the error categorization logic
2. **Extend metrics collection** with additional performance data
3. **Create custom reporters** that utilize error instrumentation
4. **Improve error categorization** accuracy

## Future Enhancements

Planned improvements include:

- 🔄 **Automatic error pattern learning** - AI-powered error classification
- 📊 **Visual dashboards** - Web-based error analytics
- 🔗 **Integration plugins** - Direct integration with monitoring services
- 📈 **Trend analysis** - Historical error pattern analysis
- 🎯 **Smart suggestions** - Automated debugging hints

---

For more information, see the [Vitest documentation](https://vitest.dev) or the [error instrumentation source code](../packages/vitest/src/node/instrumentation/error-tracker.ts).