import { HttpModule } from '@nestjs/axios';
import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { TraceModule } from 'tajo-toolkit';
import { v4 as uuidv4 } from 'uuid';

// Core configuration
import { AppConfigModule } from '@config/app/app-config.module';
import { AppConfigService } from '@config/app/app-config.service';
import { ServicesConfigModule } from '@config/services/services-config.module';

// Feature modules
import { ApplicationModule } from '@application/application.module';
import { HttpExceptionFilter } from '@common/exceptions/http.exception';
import { HealthModule } from '@health/health.module';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';
import { AuthMiddleware } from '@infrastructure/middleware/auth.middleware';
import { PermissionMiddleware } from '@infrastructure/middleware/permission.middleware';

const CORRELATION_ID_HEADER = 'x-trace-id';

@Module({
    imports: [
        // Global Configs
        AppConfigModule,
        ServicesConfigModule,

        // Tracing
        TraceModule.forRoot({
            serviceName: process.env.APP_NAME || 'ms-gateway-api',
            logsApiUrl: process.env.LOGS_API_URL || '',
            apiKey: process.env.X_API_KEY,
        }),

        // Feature Modules
        ApplicationModule,
        InfrastructureModule,
        HealthModule,

        // Logging
        LoggerModule.forRootAsync({
            imports: [AppConfigModule],
            inject: [AppConfigService],
            useFactory: async (config: AppConfigService) => ({
                pinoHttp: {
                    level: config.logLevel,
                    genReqId: (req) => req.headers[CORRELATION_ID_HEADER] || uuidv4(),
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
                    exclude: [
                        { method: RequestMethod.ALL, path: 'health' },
                        { method: RequestMethod.POST, path: 'auth/validate' },
                    ],
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
        const publicRoutes = [
            { path: 'auth/login', method: RequestMethod.POST },
            { path: 'auth/register', method: RequestMethod.POST },
            { path: 'auth/logout', method: RequestMethod.POST },
            { path: 'auth/refresh', method: RequestMethod.POST },
            { path: 'auth/validate', method: RequestMethod.POST },
            { path: 'health', method: RequestMethod.GET },
        ];

        // AuthMiddleware on all non-public routes (including auth/me)
        consumer
            .apply(AuthMiddleware)
            .exclude(...publicRoutes)
            .forRoutes('*');

        // PermissionMiddleware skips public routes AND auth/me (no permission check needed for self-info)
        consumer
            .apply(PermissionMiddleware)
            .exclude(...publicRoutes, { path: 'auth/me', method: RequestMethod.GET })
            .forRoutes('*');
    }
}
