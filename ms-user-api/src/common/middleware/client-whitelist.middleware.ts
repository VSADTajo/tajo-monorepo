import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class ClientWhitelistMiddleware implements NestMiddleware {
    use(req: Request, _res: Response, next: NextFunction): void {
        // Permitir siempre healthchecks
        if (req.path === '/health') {
            return next();
        }

        const internalCaller = req.headers['x-internal-caller'] as string | undefined;
        const allowedCallers = ['ms-authentication-api', 'ms-gateway-api'];

        if (internalCaller && allowedCallers.includes(internalCaller)) {
            return next();
        }

        throw new ForbiddenException('Client not allowed');

        return;
    }
}
