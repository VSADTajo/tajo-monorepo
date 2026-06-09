import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SWAGGER_TAGS } from './swagger-tags/swagger-tags.constants';
import { SwaggerUI } from './swagger-ui.class';

export class SwaggerDocumentBuilder {
    constructor(private readonly app: INestApplication<any>) {}

    private buildConfig() {
        const docBuilder = new DocumentBuilder()
            .setTitle('User API')
            .setDescription('User and role management service.')
            .setVersion('1.0')
            .addBasicAuth()
            .addBearerAuth(
                {
                    bearerFormat: 'Bearer',
                    scheme: 'Bearer',
                    type: 'http',
                    in: 'Header',
                },
                'JWTAuthorization',
            );

        SWAGGER_TAGS.forEach((tag) => {
            docBuilder.addTag(tag.name, tag.description);
        });

        return docBuilder.build();
    }

    private createDocument() {
        const config = this.buildConfig();
        return SwaggerModule.createDocument(this.app, config);
    }

    public setupSwagger() {
        const document = this.createDocument();

        const swaggerUI = new SwaggerUI();
        SwaggerModule.setup('docs', this.app, document, swaggerUI.customOptions);
    }
}
