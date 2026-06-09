import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

/**
 * Legacy middleware kept for backwards compatibility.
 * Currently acts as a no-op: the gateway is open to any client.
 */
@Injectable()
export class ClientWhitelistMiddleware implements NestMiddleware {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    use(_req: Request, _res: Response, next: NextFunction): void {
        next();
    }
}
