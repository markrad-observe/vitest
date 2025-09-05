import type { File, TaskEventPack, TaskResultPack, TestAnnotation } from '@vitest/runner'

import type { IncomingMessage } from 'node:http'
import type { ViteDevServer } from 'vite'
import type { WebSocket } from 'ws'
import type { Vitest } from '../node/core'
import type { TestCase } from '../node/reporters/reported-tasks'
import type { Reporter } from '../node/types/reporter'
import type { SerializedTestSpecification } from '../runtime/types/utils'
import type { Awaitable, LabelColor, ModuleGraphData, UserConsoleLog } from '../types/general'
import type {
  TransformResultWithSource,
  WebSocketEvents,
  WebSocketHandlers,
  WebSocketRPC,
} from './types'
import { existsSync, promises as fs } from 'node:fs'
import { context, SpanStatusCode, trace } from '@opentelemetry/api'
import { SeverityNumber } from '@opentelemetry/api-logs'
import { isPrimitive, noop } from '@vitest/utils'
import { createBirpc } from 'birpc'
import { parse, stringify } from 'flatted'
import { WebSocketServer } from 'ws'
import { logger, tracer } from '../otel'
import { API_PATH } from '../constants'
import * as metrics from '../node/metrics'
import { getModuleGraph } from '../utils/graph'
import { stringifyReplace } from '../utils/serialization'
import { parseErrorStacktrace } from '../utils/source-map'
import { isValidApiRequest } from './check'

export function setup(ctx: Vitest, _server?: ViteDevServer): void {
  const span = tracer.startSpan('vitest.api.setup', {
    attributes: {
      'vitest.api.server_provided': !!_server,
    },
  })

  try {
    trace.setSpan(context.active(), span)

    logger.emit({
      severityNumber: SeverityNumber.INFO,
      severityText: 'INFO',
      body: 'Setting up Vitest API server',
      attributes: {
        server_provided: !!_server,
      },
    })

    const wss = new WebSocketServer({ noServer: true })
    const clients = new Map<WebSocket, WebSocketRPC>()
    const server = _server || ctx.server

    server.httpServer?.on('upgrade', (request: IncomingMessage, socket, head) => {
      const connectionSpan = tracer.startSpan('vitest.api.websocket.upgrade', {
        attributes: {
          'http.url': request.url || 'unknown',
          'http.method': 'GET',
        },
      })

      try {
        if (!request.url) {
          connectionSpan.setStatus({ code: SpanStatusCode.ERROR, message: 'No URL provided' })
          return
        }

        const { pathname } = new URL(request.url, 'http://localhost')
        connectionSpan.setAttributes({
          'http.route': pathname,
        })

        if (pathname !== API_PATH) {
          connectionSpan.setStatus({ code: SpanStatusCode.ERROR, message: 'Invalid API path' })
          return
        }

        if (!isValidApiRequest(ctx.config, request)) {
          connectionSpan.setStatus({ code: SpanStatusCode.ERROR, message: 'Invalid API request' })
          socket.destroy()
          return
        }

        wss.handleUpgrade(request, socket, head, (ws) => {
          logger.emit({
            severityNumber: SeverityNumber.INFO,
            severityText: 'INFO',
            body: 'WebSocket connection established',
            attributes: {
              url: request.url,
              pathname,
            },
          })

          // Record WebSocket connection metrics
          metrics.recordWebSocketActivity('connect', undefined, {
            endpoint: pathname,
          })

          connectionSpan.setStatus({ code: SpanStatusCode.OK })
          wss.emit('connection', ws, request)
          setupClient(ws)
        })
      }
      finally {
        connectionSpan.end()
      }
    })

    function setupClient(ws: WebSocket) {
      const rpc = createBirpc<WebSocketEvents, WebSocketHandlers>(
        {
          async onTaskUpdate(packs, events) {
            await ctx._testRun.updated(packs, events)
          },
          getFiles() {
            return ctx.state.getFiles()
          },
          getPaths() {
            return ctx.state.getPaths()
          },
          async readTestFile(id) {
            if (!ctx.state.filesMap.has(id) || !existsSync(id)) {
              return null
            }
            return fs.readFile(id, 'utf-8')
          },
          async saveTestFile(id, content) {
            if (!ctx.state.filesMap.has(id) || !existsSync(id)) {
              throw new Error(
                `Test file "${id}" was not registered, so it cannot be updated using the API.`,
              )
            }
            return fs.writeFile(id, content, 'utf-8')
          },
          async rerun(files, resetTestNamePattern) {
            await ctx.rerunFiles(files, undefined, true, resetTestNamePattern)
          },
          async rerunTask(id) {
            await ctx.rerunTask(id)
          },
          getConfig() {
            return ctx.getRootProject().serializedConfig
          },
          getResolvedProjectLabels(): { name: string; color?: LabelColor }[] {
            return ctx.projects.map(p => ({ name: p.name, color: p.color }))
          },
          async getTransformResult(projectName: string, id, browser = false) {
            const project = ctx.getProjectByName(projectName)
            const result: TransformResultWithSource | null | undefined = browser
              ? await project.browser!.vite.transformRequest(id)
              : await project.vitenode.transformRequest(id)
            if (result) {
              try {
                result.source = result.source || (await fs.readFile(id, 'utf-8'))
              }
              catch {}
              return result
            }
          },
          async getModuleGraph(project, id, browser): Promise<ModuleGraphData> {
            return getModuleGraph(ctx, project, id, browser)
          },
          async updateSnapshot(file?: File) {
            if (!file) {
              await ctx.updateSnapshot()
            }
            else {
              await ctx.updateSnapshot([file.filepath])
            }
          },
          getUnhandledErrors() {
            return ctx.state.getUnhandledErrors()
          },
          async getTestFiles() {
            const spec = await ctx.globTestSpecifications()
            return spec.map(spec => [
              {
                name: spec.project.config.name,
                root: spec.project.config.root,
              },
              spec.moduleId,
              { pool: spec.pool },
            ])
          },
        },
        {
          post: msg => ws.send(msg),
          on: fn => ws.on('message', fn),
          eventNames: [
            'onUserConsoleLog',
            'onFinished',
            'onFinishedReportCoverage',
            'onCollected',
            'onTaskUpdate',
          ],
          serialize: (data: any) => stringify(data, stringifyReplace),
          deserialize: parse,
          onTimeoutError(functionName) {
            throw new Error(`[vitest-api]: Timeout calling "${functionName}"`)
          },
        },
      )

      clients.set(ws, rpc)

      ws.on('close', () => {
        clients.delete(ws)

        // Record WebSocket disconnection metrics
        metrics.recordWebSocketActivity('disconnect')
      })
    }

    ctx.reporters.push(new WebSocketReporter(ctx, wss, clients))

    span.setAttributes({
      'vitest.api.clients.count': clients.size,
    })

    span.setStatus({ code: SpanStatusCode.OK })

    logger.emit({
      severityNumber: SeverityNumber.INFO,
      severityText: 'INFO',
      body: 'Vitest API server setup completed',
      attributes: {
        clients_count: clients.size,
      },
    })
  }
  catch (error) {
    span.recordException(error as Error)
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: (error as Error).message,
    })

    logger.emit({
      severityNumber: SeverityNumber.ERROR,
      severityText: 'ERROR',
      body: 'Failed to setup Vitest API server',
      attributes: {
        error: (error as Error).message,
        stack: (error as Error).stack,
      },
    })

    throw error
  }
  finally {
    span.end()
  }
}

export class WebSocketReporter implements Reporter {
  constructor(
    public ctx: Vitest,
    public wss: WebSocketServer,
    public clients: Map<WebSocket, WebSocketRPC>,
  ) {}

  onCollected(files?: File[]): void {
    if (this.clients.size === 0) {
      return
    }
    this.clients.forEach((client) => {
      client.onCollected?.(files)?.catch?.(noop)
    })
  }

  onSpecsCollected(specs?: SerializedTestSpecification[] | undefined): Awaitable<void> {
    if (this.clients.size === 0) {
      return
    }
    this.clients.forEach((client) => {
      client.onSpecsCollected?.(specs)?.catch?.(noop)
    })
  }

  async onTestCaseAnnotate(testCase: TestCase, annotation: TestAnnotation): Promise<void> {
    if (this.clients.size === 0) {
      return
    }

    this.clients.forEach((client) => {
      client.onTestAnnotate?.(testCase.id, annotation)?.catch?.(noop)
    })
  }

  async onTaskUpdate(packs: TaskResultPack[], events: TaskEventPack[]): Promise<void> {
    if (this.clients.size === 0) {
      return
    }

    packs.forEach(([taskId, result]) => {
      const task = this.ctx.state.idMap.get(taskId)
      const isBrowser = task && task.file.pool === 'browser'

      result?.errors?.forEach((error) => {
        if (isPrimitive(error)) {
          return
        }

        if (isBrowser) {
          const project = this.ctx.getProjectByName(task!.file.projectName || '')
          error.stacks = project.browser?.parseErrorStacktrace(error)
        }
        else {
          error.stacks = parseErrorStacktrace(error)
        }
      })
    })

    this.clients.forEach((client) => {
      client.onTaskUpdate?.(packs, events)?.catch?.(noop)
    })
  }

  onFinished(files: File[], errors: unknown[]): void {
    this.clients.forEach((client) => {
      client.onFinished?.(files, errors)?.catch?.(noop)
    })
  }

  onFinishedReportCoverage(): void {
    this.clients.forEach((client) => {
      client.onFinishedReportCoverage?.()?.catch?.(noop)
    })
  }

  onUserConsoleLog(log: UserConsoleLog): void {
    this.clients.forEach((client) => {
      client.onUserConsoleLog?.(log)?.catch?.(noop)
    })
  }
}
