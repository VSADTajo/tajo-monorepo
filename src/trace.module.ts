import { DynamicModule, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { TraceMiddleware } from './trace.middleware';
import { TracedHttpClient } from './traced-http-client';
import { TraceContext } from './trace-context';
import { TraceModuleOptions, TRACE_MODULE_OPTIONS } from './types';

@Module({})
export class TraceModule implements NestModule {
  static forRoot(options: TraceModuleOptions): DynamicModule {
    return {
      module: TraceModule,
      imports: [
        ClsModule.forRoot({
          middleware: { mount: true },
        }),
      ],
      providers: [
        {
          provide: TRACE_MODULE_OPTIONS,
          useValue: options,
        },
        TraceContext,
        TracedHttpClient,
        TraceMiddleware,
      ],
      exports: [TracedHttpClient, TraceContext],
      global: true,
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TraceMiddleware).forRoutes('*');
  }
}
