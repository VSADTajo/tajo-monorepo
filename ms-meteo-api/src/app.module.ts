import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { TraceModule, TraceContext, buildPinoOptions } from 'tajo-toolkit';

// Core configuration
import { AppConfigModule } from '@config/app/app-config.module';
import { AppConfigService } from '@config/app/app-config.service';

// Feature modules
import { ApplicationModule } from '@application/application.module';
import { HealthModule } from '@health/health.module';
import { HttpExceptionFilter } from '@common/exceptions/http.exception';
import { ClientWhitelistMiddleware } from '@common/middleware/client-whitelist.middleware';

@Module({
    imports: [
        // Global Configs
        AppConfigModule,

        // Tracing
        TraceModule.forRoot({
            serviceName: process.env.APP_NAME || 'ms-meteo-api',
            logsApiUrl: process.env.LOGS_API_URL || '',
            apiKey: process.env.X_API_KEY,
        }),

        // Scheduling (cron jobs)
        ScheduleModule.forRoot(),

        // Feature Modules
        ApplicationModule,
        HealthModule,

        // Logging
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
                    exclude: [{ method: RequestMethod.ALL, path: 'health' }],
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
