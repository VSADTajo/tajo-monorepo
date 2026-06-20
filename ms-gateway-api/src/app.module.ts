import { HttpModule } from '@nestjs/axios';
import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { TraceModule, TraceContext, buildPinoOptions } from 'tajo-toolkit';

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

        // Logging — config centralized in tajo-toolkit (buildPinoOptions)
        LoggerModule.forRootAsync({
            imports: [AppConfigModule],
            inject: [AppConfigService, TraceContext],
            useFactory: async (config: AppConfigService, traceContext: TraceContext) => ({
                pinoHttp: {
                    ...buildPinoOptions({
                        serviceName: config.name,
                        traceContext,
                        logsApiUrl: config.logsApiUrl,
                        apiKey: config.xApiKey,
                        logLevel: config.logLevel,
                        nodeEnv: config.nodeEnv,
                    }),
                    // Gateway-specific: skip noisy endpoints from auto-logging
                    exclude: [
                        { method: RequestMethod.ALL, path: 'health' },
                        { method: RequestMethod.POST, path: 'auth/validate' },
                    ],
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
