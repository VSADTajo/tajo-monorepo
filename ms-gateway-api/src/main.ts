import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { SwaggerDocumentBuilder } from './swagger/swagger-document-builder';
import helmet from 'helmet';
import { AppConfigService } from '@config/app/app-config.service';
import { CustomValidationPipe } from './common/pipes/custom-validation.pipe';
import { HttpExceptionFilter } from './common/exceptions/http.exception';
import { setupAdminPanel } from './admin';

async function bootstrap() {
    // Size the JSON body limit per route: only the scenarios passthrough accepts
    // large payloads; every other route keeps a tight limit.
    const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true, bodyParser: false });
    app.use('/scenarios', json({ limit: '1gb' }));
    app.use(json({ limit: '1mb' }));
    app.use(urlencoded({ extended: true, limit: '1mb' }));

    const appConfig: AppConfigService = app.get(AppConfigService);
    // Behind a reverse proxy: take the client IP, protocol and host from X-Forwarded-*.
    app.set('trust proxy', appConfig.trustProxy);

    const logger = app.get(Logger);
    app.useLogger(logger);

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

    await app.listen(appConfig.port);
    logger.log(`Gateway is running on: ${appConfig.url}:${appConfig.port}`);
}

void bootstrap();
