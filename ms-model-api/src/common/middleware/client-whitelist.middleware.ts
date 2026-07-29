import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

import { MOCK_FEWS_SERVICE_PATH } from '@common/mock-fews.constants';

@Injectable()
export class ClientWhitelistMiddleware implements NestMiddleware {
    use(req: Request, _res: Response, next: NextFunction): void {
        // Permitir siempre healthchecks
        if (req.path === '/health') {
            return next();
        }

        // El PI REST simulado que respalda el modo MOCK lo llama este mismo
        // proceso por loopback, no el gateway, así que la whitelist lo
        // rechazaría. Es una superficie de prueba: no expone datos de negocio,
        // su puerto no está publicado fuera de la red de docker, y el servicio
        // se niega a responderla en producción.
        if (req.path.startsWith(MOCK_FEWS_SERVICE_PATH)) {
            return next();
        }

        const internalCaller = req.headers['x-internal-caller'] as string | undefined;

        // Solo permitir llamadas desde el gateway
        const allowedCallers = ['ms-gateway-api'];

        if (internalCaller && allowedCallers.includes(internalCaller)) {
            return next();
        }

        throw new ForbiddenException('Client not allowed');
    }
}
