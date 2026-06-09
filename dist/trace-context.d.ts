import { ClsService } from 'nestjs-cls';
export declare class TraceContext {
    private readonly cls;
    constructor(cls: ClsService);
    get traceId(): string | null;
    set traceId(value: string);
    get userId(): string | null;
    set userId(value: string | null);
    get serviceName(): string;
    set serviceName(value: string);
    get startTime(): number;
    set startTime(value: number);
    get logsApiUrl(): string;
    set logsApiUrl(value: string);
    runInContext<T>(traceId: string, fn: () => Promise<T>): Promise<T>;
}
//# sourceMappingURL=trace-context.d.ts.map