import { SwaggerTag } from './swagger-tags.interface';

export const SWAGGER_TAGS: SwaggerTag[] = [
    {
        name: 'Healthchecks',
        description: 'Health route',
    },
    {
        name: 'Users',
        description: 'User management routes',
    },
    {
        name: 'Roles',
        description: 'Role management routes',
    },
];
