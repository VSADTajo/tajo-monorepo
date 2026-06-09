import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class ClientWhitelistMiddleware implements NestMiddleware {
    use(req: Request, _res: Response, next: NextFunction): void {
        // Allow healthchecks without restriction
        if (req.path === '/health') {
            return next();
        }

        const internalCaller = req.headers['x-internal-caller'] as string | undefined;
        const allowedCallers = ['ms-gateway-api', 'ms-sftp-api'];

        if (!internalCaller || !allowedCallers.includes(internalCaller)) {
            throw new ForbiddenException('Client not allowed');
        }

        return next();
    }
}
