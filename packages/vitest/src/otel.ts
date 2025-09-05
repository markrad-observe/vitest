// Import trace and metrics APIs to get tracer and meter
import { metrics, trace } from '@opentelemetry/api'
import { logs, SeverityNumber } from '@opentelemetry/api-logs'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import {
  BatchLogRecordProcessor,
  LoggerProvider,
} from '@opentelemetry/sdk-logs'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { NodeSDK } from '@opentelemetry/sdk-node'

import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'

// Configuration
const serviceName: string = 'vitest' // Vitest testing framework
const serviceVersion: string = process.env.npm_package_version || 'unknown'

const otlpEndpoint: string
  = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318'
const otlpEndpointBearerToken: string | undefined = process.env.OTEL_EXPORTER_OTLP_BEARER_TOKEN

const authHeader: Record<string, string> = otlpEndpointBearerToken
  ? { Authorization: `Bearer ${otlpEndpointBearerToken}` }
  : {}

// Create resource
const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: serviceName,
  [ATTR_SERVICE_VERSION]: serviceVersion,
})

// Initialize Logger Provider
const loggerProvider: LoggerProvider = new LoggerProvider({
  resource,
  processors: [
    new BatchLogRecordProcessor(
      new OTLPLogExporter({
        url: `${otlpEndpoint}/v1/logs`,
        headers: {
          ...authHeader,
          'x-observe-target-package': 'Logs',
        },
      }),
    ),
  ],
})

// Initialize OpenTelemetry SDK
export const sdk: NodeSDK = new NodeSDK({
  resource,
  traceExporter: new OTLPTraceExporter({
    url: `${otlpEndpoint}/v1/traces`,
    headers: {
      ...authHeader,
      'x-observe-target-package': 'Tracing',
    },
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: `${otlpEndpoint}/v1/metrics`,
      headers: {
        ...authHeader,
        'x-observe-target-package': 'Metrics',
      },
    }),
  }),
  instrumentations: [getNodeAutoInstrumentations({
    // Disable some instrumentations that might interfere with Vitest
    '@opentelemetry/instrumentation-fs': {
      enabled: false, // Disable file system instrumentation to avoid noise
    },
  })],
})

// Export logger, tracer, and meter for use in Vitest components
export const logger = loggerProvider.getLogger(serviceName)
export const tracer = trace.getTracer(serviceName, serviceVersion)
export const meter = metrics.getMeter(serviceName, serviceVersion)

// Initialize OpenTelemetry and return initialized components
export function initOtel(): void {
  try {
    logs.setGlobalLoggerProvider(loggerProvider)
    sdk.start()

    logger.emit({
      severityNumber: SeverityNumber.INFO,
      severityText: 'INFO',
      body: 'OpenTelemetry SDK started for Vitest',
      attributes: {
        service: serviceName,
        version: serviceVersion,
      },
    })
  }
  catch (error) {
    logger.emit({
      severityNumber: SeverityNumber.ERROR,
      severityText: 'ERROR',
      body: 'Error starting OpenTelemetry SDK',
      attributes: { error: (error as Error).message },
    })
    throw error
  }
}

// Graceful shutdown
export function shutdownOtel(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'Shutting down OpenTelemetry SDK',
      })

      sdk.shutdown().then(() => {
        resolve()
      }).catch((error) => {
        logger.emit({
          severityNumber: SeverityNumber.ERROR,
          severityText: 'ERROR',
          body: 'Error shutting down OpenTelemetry SDK',
          attributes: { error: (error as Error).message },
        })
        reject(error)
      })
    }
    catch (error) {
      logger.emit({
        severityNumber: SeverityNumber.ERROR,
        severityText: 'ERROR',
        body: 'Error shutting down OpenTelemetry SDK',
        attributes: { error: (error as Error).message },
      })
      reject(error)
    }
  })
}
