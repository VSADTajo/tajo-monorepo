import { applyDecorators, Type } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

interface ApiErrorResponse {
    status: number;
    description: string;
}

interface ApiEndpointOptions {
    summary: string;
    description?: string;
    tags?: string[];
    body?: Type<unknown>;
    response: {
        status: number;
        type: Type<unknown>;
        description?: string;
    };
    errors?: ApiErrorResponse[];
}

export const ApiEndpoint = (options: ApiEndpointOptions) => {
    const decorators: (MethodDecorator | ClassDecorator)[] = [
        ApiOperation({
            summary: options.summary,
            description: options.description,
        }),
    ];

    if (options.tags) {
        decorators.push(ApiTags(...options.tags));
    }

    if (options.body) {
        decorators.push(ApiBody({ type: options.body }));
    }

    decorators.push(
        ApiResponse({
            status: options.response.status,
            type: options.response.type,
            description: options.response.description,
        }),
    );

    if (options.errors) {
        for (const error of options.errors) {
            decorators.push(
                ApiResponse({
                    status: error.status,
                    description: error.description,
                }),
            );
        }
    }

    return applyDecorators(...decorators);
};
