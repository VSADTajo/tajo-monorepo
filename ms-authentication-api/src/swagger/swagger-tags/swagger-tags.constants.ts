import { SwaggerTag } from './swagger-tags.interface';

export const SWAGGER_TAGS: SwaggerTag[] = [
    {
        name: 'Healthchecks',
        description: 'Health route',
    },
    {
        name: 'Auth',
        description: 'Authentication routes (login, validate)',
    },
];
