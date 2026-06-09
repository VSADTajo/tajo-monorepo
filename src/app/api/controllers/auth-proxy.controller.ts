import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import * as express from 'express';

import {
    ChangePasswordRequestDto,
    ChangePasswordResponseDto,
    LoginRequestDto,
    LoginResponseDto,
    LogoutRequestDto,
    LogoutResponseDto,
    MeResponseDto,
    RefreshTokenRequestDto,
    RegisterRequestDto,
    RegisterResponseDto,
    ValidateTokenRequestDto,
    ValidateTokenResponseDto,
} from '@api/dtos/auth-proxy.dtos';
import { RequestUser } from '@infrastructure/middleware/auth.middleware';
import { ProxyService } from '@infrastructure/services/proxy.service';
import { ServicesConfigService } from '@config/services/services-config.service';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';

const INTERNAL_CALLER_HEADER_VALUE = 'ms-gateway-api';

/** Gateway always generates x-correlation-id per outbound request (never forwards client header). */
@ApiTags('Auth')
@Controller('auth')
export class AuthProxyController {
    constructor(
        private readonly proxyService: ProxyService,
        private readonly servicesConfig: ServicesConfigService,
    ) {}

    @Post('login')
    @ApiEndpoint({
        summary: 'Login with email and password',
        description:
            'Authenticates the user and returns JWT access and refresh tokens. Proxies to ms-authentication-api.',
        body: LoginRequestDto,
        response: { status: 200, type: LoginResponseDto, description: 'Login successful' },
        errors: [
            { status: 400, description: 'Invalid payload' },
            { status: 401, description: 'Invalid credentials' },
        ],
    })
    async login(
        @Body() body: LoginRequestDto,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'POST',
            baseUrl: this.servicesConfig.authApiUrl,
            path: '/auth/login',
            body,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Post('register')
    @ApiEndpoint({
        summary: 'Register a new user',
        description:
            'Creates a new user. Password is hashed by the auth service before storing. Proxies to ms-authentication-api.',
        body: RegisterRequestDto,
        response: { status: 201, type: RegisterResponseDto, description: 'User registered' },
        errors: [
            { status: 400, description: 'Invalid payload' },
            { status: 409, description: 'User with this email already exists' },
            { status: 502, description: 'Auth service error' },
        ],
    })
    async register(
        @Body() body: RegisterRequestDto,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'POST',
            baseUrl: this.servicesConfig.authApiUrl,
            path: '/auth/register',
            body,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Post('logout')
    @ApiEndpoint({
        summary: 'Logout (invalidate token)',
        description: 'Blacklists the given token until it expires. Proxies to ms-authentication-api.',
        body: LogoutRequestDto,
        response: { status: 200, type: LogoutResponseDto, description: 'Token invalidated' },
        errors: [
            { status: 400, description: 'Invalid payload' },
            { status: 401, description: 'Invalid or expired token' },
        ],
    })
    async logout(
        @Body() body: LogoutRequestDto,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'POST',
            baseUrl: this.servicesConfig.authApiUrl,
            path: '/auth/logout',
            body,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Post('refresh')
    @ApiEndpoint({
        summary: 'Refresh access token',
        description:
            'Returns new access and refresh tokens using a valid refresh token. Proxies to ms-authentication-api.',
        body: RefreshTokenRequestDto,
        response: { status: 200, type: LoginResponseDto, description: 'New access and refresh tokens' },
        errors: [
            { status: 400, description: 'Invalid payload' },
            { status: 401, description: 'Invalid or expired refresh token' },
        ],
    })
    async refresh(
        @Body() body: RefreshTokenRequestDto,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'POST',
            baseUrl: this.servicesConfig.authApiUrl,
            path: '/auth/refresh',
            body,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Post('validate')
    @ApiEndpoint({
        summary: 'Validate JWT token',
        description: 'Checks if the token is valid and returns user id and roles. Proxies to ms-authentication-api.',
        body: ValidateTokenRequestDto,
        response: { status: 200, type: ValidateTokenResponseDto, description: 'Token validation result' },
        errors: [
            { status: 400, description: 'Invalid payload' },
            { status: 401, description: 'Invalid or expired token' },
        ],
    })
    async validate(
        @Body() body: ValidateTokenRequestDto,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'POST',
            baseUrl: this.servicesConfig.authApiUrl,
            path: '/auth/validate',
            body,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Post('change-password')
    @ApiBearerAuth('JWTAuthorization')
    @ApiEndpoint({
        summary: 'Change password (by email)',
        description:
            'Changes the user password. Identifies user by email only (no user id). Flow: Gateway → Auth API → User API. Auth API finds user by email, verifies current password, hashes new password, updates in user-api.',
        body: ChangePasswordRequestDto,
        response: { status: 200, type: ChangePasswordResponseDto, description: 'Password updated' },
        errors: [
            { status: 400, description: 'Invalid payload' },
            { status: 401, description: 'Current password is incorrect' },
            { status: 404, description: 'User not found' },
            { status: 502, description: 'Auth API or User API error' },
        ],
    })
    async changePassword(
        @Body() body: ChangePasswordRequestDto,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'POST',
            baseUrl: this.servicesConfig.authApiUrl,
            path: '/auth/change-password',
            body: {
                email: body.email,
                currentPassword: body.currentPassword,
                newPassword: body.newPassword,
            },
            headers: {
                ...(req.headers.authorization ? { authorization: req.headers.authorization as string } : {}),
                'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE,
            },
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Get('me')
    @ApiBearerAuth('JWTAuthorization')
    @ApiEndpoint({
        summary: 'Get current authenticated user',
        description:
            'Returns the userId, email, name and roles of the currently logged-in user. Requires a valid Bearer token.',
        response: { status: 200, type: MeResponseDto, description: 'Current user info' },
        errors: [{ status: 401, description: 'Missing or invalid token' }],
    })
    me(@Req() req: express.Request): MeResponseDto {
        const user = (req as express.Request & { user: RequestUser }).user;
        return {
            userId: user.userId,
            email: user.email,
            name: user.name,
            roles: user.roles,
        };
    }
}
