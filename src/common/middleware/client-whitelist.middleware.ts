import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class ClientWhitelistMiddleware implements NestMiddleware {
    use(req: Request, _res: Response, next: NextFunction): void {
        // Permitir siempre healthchecks
        if (req.path === '/health') {
            return next();
        }

        const internalCaller = req.headers['x-internal-caller'] as string | undefined;

        // Solo permitir llamadas desde el gateway, ms-model-api, ms-meteo-api y el frontend SFTP
        const allowedCallers = ['ms-gateway-api', 'ms-model-api', 'ms-meteo-api', 'sftp-frontend'];

        if (internalCaller && allowedCallers.includes(internalCaller)) {
            return next();
        }

        throw new ForbiddenException('Client not allowed');
    }
}
