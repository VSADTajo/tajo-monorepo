import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import axios from 'axios';
import { ClsService } from 'nestjs-cls';
import { TraceContext } from './trace-context';
import { X_TRACE_ID_HEADER, X_USER_ID_HEADER, TRACE_MODULE_OPTIONS, TraceModuleOptions } from './types';

@Injectable()
export class TraceMiddleware implements NestMiddleware {
  constructor(
    private readonly traceContext: TraceContext,
    private readonly cls: ClsService,
    @Inject(TRACE_MODULE_OPTIONS) private readonly options: TraceModuleOptions,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    this.cls.run(() => {
      const incomingTraceId = req.headers[X_TRACE_ID_HEADER] as string | undefined;
      const traceId = incomingTraceId && uuidValidate(incomingTraceId)
        ? incomingTraceId
        : uuidv4();

      const incomingUserId = req.headers[X_USER_ID_HEADER] as string | undefined;

      this.traceContext.traceId = traceId;
      this.traceContext.userId = incomingUserId ?? null;
      this.traceContext.serviceName = this.options.serviceName;
      this.traceContext.startTime = Date.now();
      this.traceContext.logsApiUrl = this.options.logsApiUrl;

      // Re-inject the resolved trace-id into the request headers so any downstream
      // reader (e.g. pino-http's genReqId) uses the SAME id as the CLS context.
      req.headers[X_TRACE_ID_HEADER] = traceId;
      res.setHeader(X_TRACE_ID_HEADER, traceId);

      if (this.options.logRequests) {
        res.on('finish', () => {
          this.shipLog(req, res);
        });
      }

      next();
    });
  }

  private shipLog(req: Request, res: Response): void {
    const path = req.originalUrl || req.url;

    if (path === '/health' || path === '/api/health') {
      return;
    }

    const duration = Date.now() - this.traceContext.startTime;
    const statusCode = res.statusCode;
    const userId = (req as any).user?.userId ?? this.traceContext.userId ?? null;

    const payload = {
      level: 'info' as const,
      entity: this.traceContext.serviceName,
      message: `[${req.method} ${path}] ${statusCode} ${duration}ms`,
      source: this.traceContext.serviceName,
      correlationId: this.traceContext.traceId,
      meta: {
        method: req.method,
        path,
        statusCode,
        duration,
        userId,
      },
    };

    const logsApiUrl = this.traceContext.logsApiUrl;
    if (logsApiUrl) {
      const headers: Record<string, string> = {};
      if (this.options.apiKey) {
        headers['x-api-key'] = this.options.apiKey;
      }
      axios.post(`${logsApiUrl}/api/logs`, payload, { headers }).catch(() => {});
    }
  }
}
