import { NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ClsService } from 'nestjs-cls';
import { TraceContext } from './trace-context';
import { TraceModuleOptions } from './types';
export declare class TraceMiddleware implements NestMiddleware {
    private readonly traceContext;
    private readonly cls;
    private readonly options;
    constructor(traceContext: TraceContext, cls: ClsService, options: TraceModuleOptions);
    use(req: Request, res: Response, next: NextFunction): void;
    private shipLog;
}
//# sourceMappingURL=trace.middleware.d.ts.map