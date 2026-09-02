import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { SwaggerDocumentBuilder } from './swagger/swagger-document-builder';
import helmet from 'helmet';
import { AppConfigService } from '@config/app/app-config.service';
import { CustomValidationPipe } from './common/pipes/custom-validation.pipe';
import { HttpExceptionFilter } from './common/exceptions/http.exception';
import { setupAdminPanel } from './admin';

const BODY_LIMIT = '50mb';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

    // A manual simulation input can run to several hundred KB once curves are
    // included, and the mock PI REST service receives it in this process. The
    // Express default (100kb) would reject it before the controller ran.
    app.useBodyParser('json', { limit: BODY_LIMIT });
    app.useBodyParser('urlencoded', { extended: true, limit: BODY_LIMIT });

    const appConfig: AppConfigService = app.get(AppConfigService);

    // configure logger (early so RMQ setup logs are visible)
    const logger = app.get(Logger);
    app.useLogger(logger);

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
