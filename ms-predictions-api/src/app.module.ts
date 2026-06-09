import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LoggerModule } from 'nestjs-pino';
import { TraceModule, TraceContext } from 'tajo-toolkit';
import { v4 as uuidv4 } from 'uuid';

// Core configuration
import { AppConfigModule } from '@config/app/app-config.module';
import { AppConfigService } from '@config/app/app-config.service';

// Feature modules
import { ApplicationModule } from '@application/application.module';
import { HealthModule } from '@health/health.module';
import { HttpExceptionFilter } from '@common/exceptions/http.exception';
import { ClientWhitelistMiddleware } from '@common/middleware/client-whitelist.middleware';

const CORRELATION_ID_HEADER = 'x-trace-id';

@Module({
    imports: [
        // Global Configs
        AppConfigModule,

        // Tracing
        TraceModule.forRoot({
            serviceName: process.env.APP_NAME || 'ms-predictions-api',
            logsApiUrl: process.env.LOGS_API_URL || '',
            apiKey: process.env.X_API_KEY,
        }),

        // Feature Modules
        ApplicationModule,
        HealthModule,

        // Logging
        LoggerModule.forRootAsync({
            imports: [AppConfigModule],
            inject: [AppConfigService, TraceContext],
            useFactory: async (config: AppConfigService, traceContext: TraceContext) => ({
                pinoHttp: {
                    level: config.logLevel,
                    genReqId: (req) => req.headers[CORRELATION_ID_HEADER] || uuidv4(),
                    mixin: () => {
                        try {
                            const traceId = traceContext.traceId;
                            return traceId ? { traceId } : {};
                        } catch {
                            return {};
                        }
                    },
                    transport: {
                        targets: [
                            ...(config.nodeEnv !== 'production'
                                ? [{ target: 'pino-pretty', level: config.logLevel }]
                                : [{ target: 'pino/file', options: { destination: 1 }, level: config.logLevel }]),
                            ...(config.logsApiUrl
                                ? [
                                      {
                                          target: 'tajo-toolkit/dist/pino-logs-api-transport',
                                          options: {
                                              logsApiUrl: config.logsApiUrl,
                                              serviceName: config.name,
                                              apiKey: config.xApiKey,
                                          },
                                          level: 'info',
                                      },
                                  ]
                                : []),
                        ],
                    },
                    exclude: [{ method: RequestMethod.ALL, path: 'health' }],
                    customLogLevel: (_req, res, err) => {
                        if (err || res.statusCode >= 500) return 'error';
                        if (res.statusCode >= 400) return 'warn';
                        return 'debug';
                    },
                    autoLogging: true,
                    serializers: {
                        req: (req) => ({
                            id: req.id,
                            method: req.method,
                            url: req.url,
                        }),
                        res: (res) => ({
                            statusCode: res.statusCode,
                        }),
                    },
                },
            }),
        }),

        // Utilities
        HttpModule,
    ],
    controllers: [],
    providers: [HttpExceptionFilter],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(ClientWhitelistMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
    }
}
