import { HttpException, HttpStatus, Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { Request, Response, NextFunction } from 'express';
import axios from 'axios';

import { ServicesConfigService } from '@config/services/services-config.service';

export interface RequestUser {
    userId: string;
    roles: string[];
    email?: string;
    name?: string;
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly servicesConfig: ServicesConfigService,
    ) {}

    async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            this.logger.warn({ msg: 'Auth failed: missing or invalid token', entity: 'Auth', ip: req.ip });
            throw new HttpException('Missing or invalid Authorization header', HttpStatus.UNAUTHORIZED);
        }

        const token = authHeader.slice(7);

        try {
            const response = await axios.post(
                `${this.servicesConfig.authApiUrl}/auth/validate`,
                { token },
                {
                    headers: {
                        'x-internal-caller': 'ms-gateway-api',
                        'x-trace-id': (req as any).id || '',
                    },
                },
            );

            if (response.data?.valid) {
                (req as Request & { user: RequestUser }).user = {
                    userId: response.data.userId,
                    roles: response.data.roles,
                    email: response.data.email,
                    name: response.data.name,
                };
                next();
            } else {
                this.logger.warn({ msg: 'Auth failed: missing or invalid token', entity: 'Auth', ip: req.ip });
                throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
            }
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            this.logger.error({ msg: 'Auth validation failed', entity: 'Auth', error: String(error) });
            throw new HttpException('Authentication failed', HttpStatus.UNAUTHORIZED);
        }
    }
}
