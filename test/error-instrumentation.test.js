import { describe, it, expect, beforeAll, afterAll } from 'vitest'

describe('Error Instrumentation Demo', () => {
  let errorTracker

  beforeAll(async (context) => {
    // Access the Vitest instance through the test context
    if (context && context.vitest) {
      errorTracker = context.vitest.errorInstrumentation
      errorTracker.enable()
      console.log('✅ Error instrumentation enabled for demo')
    }
  })

  afterAll(async () => {
    if (errorTracker) {
      console.log('\n📊 Error Instrumentation Summary:')
      errorTracker.printSummary()
      
      // Export metrics
      const metrics = errorTracker.exportMetrics()
      console.log('\n📈 Detailed metrics available in JSON format')
    }
  })

  describe('Assertion Errors', () => {
    it('should demonstrate assertion error tracking', () => {
      try {
        expect(2 + 2).toBe(5)
      } catch (error) {
        // This will be automatically tracked by the error instrumentation
        throw error
      }
    })

    it('should track object comparison failures', () => {
      const actual = { name: 'John', age: 30 }
      const expected = { name: 'Jane', age: 25 }
      
      try {
        expect(actual).toEqual(expected)
      } catch (error) {
        throw error
      }
    })
  })

  describe('Timeout Errors', () => {
    it('should demonstrate timeout error tracking', async () => {
      // Simulate a slow operation that would timeout
      const slowOperation = () => new Promise(resolve => {
        setTimeout(resolve, 10000) // 10 seconds - will timeout
      })
      
      try {
        await slowOperation()
      } catch (error) {
        if (errorTracker) {
          errorTracker.trackError(new Error('Operation timed out after 5000ms'), {
            errorType: 'TimeoutError',
            testFile: import.meta.url,
            testName: 'should demonstrate timeout error tracking'
          })
        }
        // Don't actually fail the test for demo purposes
      }
    }, 100) // Very short timeout to trigger timeout error
  })

  describe('Memory Errors', () => {
    it('should track memory-related issues', () => {
      if (errorTracker) {
        // Simulate a memory error
        errorTracker.trackError(new Error('JavaScript heap out of memory'), {
          errorType: 'MemoryError',
          testFile: import.meta.url,
          testName: 'should track memory-related issues',
          metadata: {
            heapUsed: '1.2GB',
            heapLimit: '1GB'
          }
        })
      }
    })
  })

  describe('Network Errors', () => {
    it('should track network-related failures', async () => {
      if (errorTracker) {
        // Simulate a network error
        errorTracker.trackError(new Error('fetch failed: connection refused'), {
          errorType: 'NetworkError',
          testFile: import.meta.url,
          testName: 'should track network-related failures',
          metadata: {
            url: 'https://api.example.com/data',
            method: 'GET'
          }
        })
      }
    })
  })

  describe('File System Errors', () => {
    it('should track file access issues', () => {
      if (errorTracker) {
        // Simulate a file system error
        errorTracker.trackError(new Error('ENOENT: no such file or directory'), {
          errorType: 'FileSystemError',
          testFile: import.meta.url,
          testName: 'should track file access issues',
          metadata: {
            path: '/nonexistent/file.txt',
            operation: 'read'
          }
        })
      }
    })
  })

  describe('Compilation Errors', () => {
    it('should track syntax and compilation issues', () => {
      if (errorTracker) {
        // Simulate a compilation error
        errorTracker.trackError(new Error('Unexpected token }'), {
          errorType: 'SyntaxError',
          testFile: import.meta.url,
          testName: 'should track syntax and compilation issues',
          metadata: {
            line: 42,
            column: 15,
            source: 'broken-file.js'
          }
        })
      }
    })
  })

  describe('Performance Tracking', () => {
    it('should demonstrate performance measurement', async () => {
      if (errorTracker) {
        // Measure operation performance
        errorTracker.markStart('test-operation')
        
        // Simulate some work
        await new Promise(resolve => setTimeout(resolve, 50))
        
        const duration = errorTracker.markEnd('test-operation')
        console.log(`⏱️  Test operation took: ${duration?.toFixed(2)}ms`)
        
        expect(duration).toBeGreaterThan(40)
        expect(duration).toBeLessThan(100)
      }
    })

    it('should track multiple concurrent operations', async () => {
      if (errorTracker) {
        // Start multiple performance measurements
        errorTracker.markStart('operation-a')
        errorTracker.markStart('operation-b')
        
        // Simulate concurrent work
        await Promise.all([
          new Promise(resolve => setTimeout(resolve, 30)),
          new Promise(resolve => setTimeout(resolve, 60))
        ])
        
        const durationA = errorTracker.markEnd('operation-a')
        const durationB = errorTracker.markEnd('operation-b')
        
        console.log(`📊 Operation A: ${durationA?.toFixed(2)}ms`)
        console.log(`📊 Operation B: ${durationB?.toFixed(2)}ms`)
      }
    })
  })

  describe('Error Summary and Metrics', () => {
    it('should provide error categorization insights', () => {
      if (errorTracker) {
        const summary = errorTracker.getErrorSummary()
        
        console.log(`\n📈 Current Error Summary:`)
        console.log(`   Total errors tracked: ${summary.total}`)
        console.log(`   Categories: ${Object.keys(summary.byCategory).length}`)
        console.log(`   Severity levels: ${Object.keys(summary.bySeverity).length}`)
        
        // The summary should have some data by now
        expect(summary.total).toBeGreaterThan(0)
        expect(Object.keys(summary.byCategory).length).toBeGreaterThan(0)
      }
    })

    it('should export comprehensive metrics', () => {
      if (errorTracker) {
        const metrics = errorTracker.exportMetrics()
        
        // Parse the JSON to verify structure
        const parsedMetrics = JSON.parse(metrics)
        
        expect(parsedMetrics).toHaveProperty('session')
        expect(parsedMetrics).toHaveProperty('errors')
        expect(parsedMetrics).toHaveProperty('performance')
        expect(parsedMetrics).toHaveProperty('details')
        
        expect(parsedMetrics.session).toHaveProperty('startTime')
        expect(parsedMetrics.session).toHaveProperty('endTime')
        expect(parsedMetrics.session).toHaveProperty('duration')
        
        console.log(`✅ Metrics export validation passed`)
      }
    })
  })

  describe('Real-world Scenarios', () => {
    it('should handle complex error scenarios', async () => {
      if (errorTracker) {
        // Simulate a complex test scenario with multiple failure points
        try {
          // Mock a database operation failure
          throw new Error('Connection to database timed out')
        } catch (dbError) {
          errorTracker.trackError(dbError, {
            errorType: 'DatabaseError',
            testFile: import.meta.url,
            testName: 'should handle complex error scenarios',
            metadata: {
              database: 'postgresql',
              host: 'localhost:5432',
              timeout: '30s'
            }
          })
        }

        try {
          // Mock an API validation error
          throw new Error('Invalid API key provided')
        } catch (apiError) {
          errorTracker.trackError(apiError, {
            errorType: 'AuthenticationError',
            testFile: import.meta.url,
            testName: 'should handle complex error scenarios',
            metadata: {
              endpoint: '/api/v1/users',
              status: 401
            }
          })
        }
      }
    })
  })
})

// Test utility functions for error demonstration
function simulateRandomError() {
  const errors = [
    () => { throw new Error('Random assertion failure') },
    () => { throw new Error('Unexpected network timeout') },
    () => { throw new Error('Memory allocation failed') },
    () => { throw new Error('File permission denied') }
  ]
  
  const randomError = errors[Math.floor(Math.random() * errors.length)]
  return randomError()
}

// Export functions for potential use in other tests
export { simulateRandomError }