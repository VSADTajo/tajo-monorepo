import { Catch, ExceptionFilter, ArgumentsHost, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { Response } from 'express';
import { Logger } from 'nestjs-pino';

import { ApiError } from '@domain/errors/api.error';
import { ValidationErrorCode } from '../validation-error-map';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    constructor(@Inject(Logger) private readonly logger: Logger) {}

    catch(exception: HttpException | ApiError | Error, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let errorCode: string = ValidationErrorCode.Default;
        let errorDescription = 'Internal server error';

        if (exception instanceof ApiError) {
            status = exception.statusCode;
            errorCode = exception.code?.toString() ?? ValidationErrorCode.Default;
            errorDescription = exception.message;
        } else if (exception instanceof HttpException) {
            status = exception.getStatus?.() || HttpStatus.INTERNAL_SERVER_ERROR;

            const exceptionResponse = exception.getResponse();
            if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
                const res = exceptionResponse as Record<string, any>;
                if (res.ErrorCode && res.ErrorDescription) {
                    errorCode = res.ErrorCode;
                    errorDescription = res.ErrorDescription;
                } else if (res.message) {
                    const message = res.message;
                    errorDescription = Array.isArray(message) ? message.join(', ') : message;
                }
            } else if (typeof exceptionResponse === 'string') {
                errorDescription = exceptionResponse;
            }
        } else if (exception instanceof Error) {
            errorDescription = exception.message;
        }

        this.logger.error({
            msg: errorDescription,
            entity: 'Exception',
            type:
                exception instanceof ApiError
                    ? 'ApiError'
                    : exception instanceof HttpException
                      ? 'HttpException'
                      : 'Error',
            method: request.method,
            url: request.url,
            statusCode: status,
            errorCode,
            stack: exception instanceof Error ? exception.stack : undefined,
        });

        response.status(status).json({
            StatusCode: status,
            ErrorCode: errorCode,
            ErrorDescription: errorDescription,
        });
    }
}
