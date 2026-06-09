import { SwaggerTag } from './swagger-tags.interface';

export const SWAGGER_TAGS: SwaggerTag[] = [
    {
        name: 'Healthchecks',
        description: 'Health route',
    },
    {
        name: 'Auth',
        description: 'Auth proxy routes (login, signup)',
    },
    {
        name: 'Users',
        description: 'User proxy routes',
    },
    {
        name: 'Roles',
        description: 'Role proxy routes',
    },
];
