import { Inject, Injectable, Logger, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { IAuthValidationService } from '@domain/ports/auth-validation.port';
import { ProviderError } from '@domain/errors/provider.error';

interface RequestUser {
    userId: string;
    roles: string[];
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly authValidationService: IAuthValidationService,
    ) {}

    private readonly allowedInternalCallers = ['ms-gateway-api', 'ms-model-api', 'ms-meteo-api', 'ms-predictions-api'];

    async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
        // Bypass auth for trusted internal service-to-service calls
        const internalCaller = req.headers['x-internal-caller'] as string | undefined;
        if (internalCaller && this.allowedInternalCallers.includes(internalCaller)) {
            return next();
        }

        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith('Bearer ')) {
            throw new HttpException('Missing or invalid Authorization header', HttpStatus.UNAUTHORIZED);
        }

        const token = authHeader.slice(7);

        try {
            const result = await this.authValidationService.validate(token);

            if (result.valid) {
                (req as Request & { user: RequestUser }).user = {
                    userId: result.userId!,
                    roles: result.roles!,
                };
                next();
            } else {
                throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
            }
        } catch (error) {
            if (error instanceof HttpException) throw error;
            if (error instanceof ProviderError) {
                throw new HttpException('Authentication service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
            }
            this.logger.error(`Auth middleware error: ${error}`);
            throw new HttpException('Authentication failed', HttpStatus.UNAUTHORIZED);
        }
    }
}
