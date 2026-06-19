import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { SwaggerDocumentBuilder } from './swagger/swagger-document-builder';
import helmet from 'helmet';
import { AppConfigService } from '@config/app/app-config.service';
import { RabbitmqConfigService } from '@config/rabbitmq/rabbitmq-config.service';
import { CustomValidationPipe } from './common/pipes/custom-validation.pipe';
import { HttpExceptionFilter } from './common/exceptions/http.exception';
import { setupAdminPanel } from './admin';
import { Queues } from '@infrastructure/messaging/messaging.registry';

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
                queue: Queues.PREDICTIONS_TIMESERIES_PROCESSING,
                queueOptions: {
                    durable: true,
                    arguments: {
                        'x-dead-letter-exchange': '',
                    },
                },
                prefetchCount: rabbitmqConfig.prefetch,
                noAck: false,
            },
        });

        app.connectMicroservice<MicroserviceOptions>({
            transport: Transport.RMQ,
            options: {
                urls: [rabbitmqConfig.url],
                queue: Queues.PREDICTIONS_SIMULATION_STATUS_UPDATES,
                queueOptions: {
                    durable: true,
                    arguments: {
                        'x-dead-letter-exchange': '',
                    },
                },
                prefetchCount: rabbitmqConfig.prefetch,
                noAck: false,
            },
        });

        await app.startAllMicroservices();
        logger.log(
            `RabbitMQ consumers listening on: ${Queues.PREDICTIONS_TIMESERIES_PROCESSING}, ${Queues.PREDICTIONS_SIMULATION_STATUS_UPDATES}`,
        );
    } else {
        logger.log('RabbitMQ is disabled (RABBITMQ_ENABLED=false) — skipping microservice setup');
    }

    await setupAdminPanel(app);

    app.useGlobalPipes(new CustomValidationPipe());
    app.useGlobalFilters(app.get(HttpExceptionFilter));
    app.use(helmet({ contentSecurityPolicy: false }));
    app.enableCors();

    const swaggerDocumentBuilder = new SwaggerDocumentBuilder(app);
    swaggerDocumentBuilder.setupSwagger();

    await app.listen(appConfig.port);
    logger.log(`Application is running on: ${appConfig.url}:${appConfig.port}`);
}

void bootstrap();
