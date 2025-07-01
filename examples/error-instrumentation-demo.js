#!/usr/bin/env node

/**
 * Vitest Error Instrumentation Demo
 * 
 * This script demonstrates how to use the error instrumentation system
 * to track and analyze errors in your Vitest test runs.
 */

import { startVitest } from '../packages/vitest/src/node/cli/cli-api.js'

async function demoErrorInstrumentation() {
  console.log('🚀 Starting Vitest with Error Instrumentation Demo...\n')

  // Start Vitest with error instrumentation enabled
  const vitest = await startVitest('test', [], {
    root: process.cwd(),
    // Basic test configuration
    include: ['test/**/*.{test,spec}.{js,ts}'],
    // Enable coverage to show error tracking in coverage provider
    coverage: {
      enabled: true,
      provider: 'v8'
    },
    watch: false,
    // Enable error instrumentation through environment variable
    // In actual usage, you can set VITEST_ERROR_INSTRUMENTATION=true
  })

  if (!vitest) {
    console.error('❌ Failed to start Vitest')
    process.exit(1)
  }

  console.log('✅ Vitest started successfully')

  // Enable error instrumentation manually
  console.log('🔧 Enabling error instrumentation...')
  vitest.errorInstrumentation.enable()

  // Demonstrate error tracking by simulating some errors
  console.log('📊 Demonstrating error tracking...')

  // Track a sample assertion error
  vitest.errorInstrumentation.trackError(
    new Error('Sample assertion failed: expected 5 to equal 10'),
    {
      errorType: 'AssertionError',
      testFile: 'example.test.js',
      testName: 'should calculate correctly'
    }
  )

  // Track a timeout error
  vitest.errorInstrumentation.trackError(
    new Error('Test timed out after 5000ms'),
    {
      errorType: 'TimeoutError',
      testFile: 'slow.test.js',
      testName: 'should complete within timeout'
    }
  )

  // Track a compilation error
  vitest.errorInstrumentation.trackError(
    new Error('Unexpected token }'),
    {
      errorType: 'SyntaxError',
      testFile: 'broken.test.js'
    }
  )

  // Track a memory error
  vitest.errorInstrumentation.trackError(
    new Error('JavaScript heap out of memory'),
    {
      errorType: 'MemoryError',
      testFile: 'memory-intensive.test.js',
      testName: 'should handle large datasets'
    }
  )

  // Demonstrate performance tracking
  console.log('⏱️  Demonstrating performance tracking...')
  
  vitest.errorInstrumentation.markStart('test-suite-execution')
  
  // Simulate test execution time
  await new Promise(resolve => setTimeout(resolve, 100))
  
  const duration = vitest.errorInstrumentation.markEnd('test-suite-execution')
  console.log(`📈 Test suite execution took: ${duration?.toFixed(2)}ms`)

  // Print summary
  console.log('\n📊 Error Instrumentation Summary:')
  vitest.errorInstrumentation.printSummary()

  // Export metrics
  console.log('\n📁 Exporting metrics...')
  const metrics = vitest.errorInstrumentation.exportMetrics()
  
  // Save to file (optional)
  try {
    const fs = await import('fs')
    fs.writeFileSync('./vitest-error-metrics.json', metrics)
    console.log('✅ Metrics exported to vitest-error-metrics.json')
  } catch (error) {
    console.log('ℹ️  Metrics displayed above (file save failed)')
  }

  // Demonstrate error categorization
  console.log('\n🏷️  Error Categories Detected:')
  const summary = vitest.errorInstrumentation.getErrorSummary()
  Object.entries(summary.byCategory).forEach(([category, count]) => {
    console.log(`  ${category}: ${count} error${count !== 1 ? 's' : ''}`)
  })

  console.log('\n📊 Error Severity Levels:')
  Object.entries(summary.bySeverity).forEach(([severity, count]) => {
    const emoji = severity === 'critical' ? '🚨' : 
                  severity === 'high' ? '⚠️' : 
                  severity === 'medium' ? '⚡' : '💡'
    console.log(`  ${emoji} ${severity}: ${count} error${count !== 1 ? 's' : ''}`)
  })

  // Show recent errors
  if (summary.recentErrors.length > 0) {
    console.log('\n🕒 Recent Errors:')
    summary.recentErrors.slice(0, 3).forEach((error, index) => {
      console.log(`  ${index + 1}. ${error.errorType} in ${error.testFile || 'unknown file'}`)
      if (error.testName) {
        console.log(`     Test: ${error.testName}`)
      }
      console.log(`     Category: ${error.category}, Severity: ${error.severity}`)
    })
  }

  console.log('\n✨ Demo completed!')
  console.log('\n💡 How to use in your project:')
  console.log('   1. Set environment variable: VITEST_ERROR_INSTRUMENTATION=true')
  console.log('   2. Or programmatically: vitest.errorInstrumentation.enable()')
  console.log('   3. Run your tests as normal')
  console.log('   4. Access metrics via vitest.errorInstrumentation.getErrorSummary()')
  console.log('   5. Export detailed metrics with vitest.errorInstrumentation.exportMetrics()')

  console.log('\n🔧 Integration Ideas:')
  console.log('   • CI/CD pipelines: Track error trends over time')
  console.log('   • Development: Identify problematic test patterns')
  console.log('   • Debugging: Categorize and prioritize test failures')
  console.log('   • Monitoring: Set up alerts for critical errors')
  console.log('   • Analytics: Generate reports on test reliability')

  // Cleanup
  await vitest.close()
}

// Handle errors gracefully
async function main() {
  try {
    await demoErrorInstrumentation()
  } catch (error) {
    console.error('❌ Demo failed:', error.message)
    console.error('This might happen if:')
    console.error('  • The demo is run outside the Vitest repository')
    console.error('  • Dependencies are not properly installed')
    console.error('  • The Vitest build is incomplete')
    console.error('\nTo use error instrumentation in your project:')
    console.error('  1. Install Vitest: npm install vitest')
    console.error('  2. Import and use: import { ErrorInstrumentation } from "vitest"')
    process.exit(1)
  }
}

main()