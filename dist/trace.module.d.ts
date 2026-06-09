import { DynamicModule, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { TraceModuleOptions } from './types';
export declare class TraceModule implements NestModule {
    static forRoot(options: TraceModuleOptions): DynamicModule;
    configure(consumer: MiddlewareConsumer): void;
}
//# sourceMappingURL=trace.module.d.ts.map