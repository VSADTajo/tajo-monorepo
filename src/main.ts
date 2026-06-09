import { AppConfigService } from '@config/app/app-config.service';
import { RabbitmqConfigService } from '@config/rabbitmq/rabbitmq-config.service';
import { Queues } from '@infrastructure/messaging/messaging.registry';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { setupAdminPanel } from './admin';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/exceptions/http.exception';
import { CustomValidationPipe } from './common/pipes/custom-validation.pipe';
import { SwaggerDocumentBuilder } from './swagger/swagger-document-builder';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, { bufferLogs: true });

    const appConfig: AppConfigService = app.get(AppConfigService);
    const rabbitmqConfig: RabbitmqConfigService = app.get(RabbitmqConfigService);

    // configure logger (early so RMQ setup logs are visible)
    const logger = app.get(Logger);
    app.useLogger(logger);

    // RabbitMQ microservice (consumer) — only if enabled
    if (rabbitmqConfig.enabled) {
        app.connectMicroservice<MicroserviceOptions>({
            transport: Transport.RMQ,
            options: {
                urls: [rabbitmqConfig.url],
                queue: Queues.EXAMPLE_PROCESSING,
                queueOptions: { durable: true },
                prefetchCount: rabbitmqConfig.prefetch,
                noAck: false,
            },
        });
        await app.startAllMicroservices();
        logger.log(`RabbitMQ consumer listening on queue: ${Queues.EXAMPLE_PROCESSING}`);
    } else {
        logger.log('RabbitMQ is disabled (RABBITMQ_ENABLED=false) — skipping microservice setup');
    }

    await setupAdminPanel(app);

    app.useGlobalPipes(new CustomValidationPipe());
    app.useGlobalFilters(app.get(HttpExceptionFilter));
    app.use(helmet({ contentSecurityPolicy: false }));
    const allowed = appConfig.allowedOrigins.trim();
    app.enableCors({
        origin: allowed === '*' ? true : allowed.split(',').map((o) => o.trim()),
    });

    const swaggerDocumentBuilder = new SwaggerDocumentBuilder(app);
    swaggerDocumentBuilder.setupSwagger();

    await app.listen(appConfig.port, '0.0.0.0');
    logger.log(`Application is running on: ${appConfig.url}:${appConfig.port}`);
}

void bootstrap();
