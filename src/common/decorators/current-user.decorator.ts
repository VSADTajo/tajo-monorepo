import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestUser } from '@domain/types/jwt-payload.type';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as RequestUser;
});
