import { Body, Controller, Headers, HttpCode, HttpException, HttpStatus, Inject, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

// DTOs
import {
    ChangePasswordRequestDto,
    ChangePasswordResponseDto,
    LoginRequestDto,
    LoginResponseDto,
    LogoutRequestDto,
    LogoutResponseDto,
    RefreshTokenRequestDto,
    RegisterRequestDto,
    RegisterResponseDto,
    ValidateTokenRequestDto,
    ValidateTokenResponseDto,
} from '@api/dtos/auth.dtos';

// Mappers
import {
    ChangePasswordMapper,
    LoginMapper,
    LogoutMapper,
    RefreshTokenMapper,
    RegisterMapper,
    ValidateTokenMapper,
} from '@application/mappers/auth.mappers';

// Errors
import { ApiError } from '@domain/errors/api.error';
import { EntityError } from '@domain/errors/entity.error';
import { ProviderError } from '@domain/errors/provider.error';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly commandBus: CommandBus,
    ) {}

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiEndpoint({
        summary: 'Login with email and password',
        body: LoginRequestDto,
        response: { status: 200, type: LoginResponseDto, description: 'Login successful' },
        errors: [
            { status: 400, description: 'Invalid payload' },
            { status: 401, description: 'Invalid credentials' },
        ],
    })
    async login(
        @Body() dto: LoginRequestDto,
        @Headers('x-correlation-id') correlationId?: string,
    ): Promise<LoginResponseDto> {
        this.logger.log({ msg: 'Login request', entity: 'Auth' });
        const command = LoginMapper.toCommand(dto, correlationId);
        try {
            const result = await this.commandBus.execute(command);
            return LoginMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }

            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }

            this.logger.error({ msg: 'Error during login', entity: 'Auth', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Post('register')
    @HttpCode(HttpStatus.CREATED)
    @ApiEndpoint({
        summary: 'Register a new user (hashes password and forwards to user-api)',
        body: RegisterRequestDto,
        response: { status: 201, type: RegisterResponseDto, description: 'User registered' },
        errors: [
            { status: 400, description: 'Invalid payload' },
            { status: 409, description: 'User with this email already exists' },
            { status: 502, description: 'User API error' },
        ],
    })
    async register(
        @Body() dto: RegisterRequestDto,
        @Headers('x-correlation-id') correlationId?: string,
    ): Promise<RegisterResponseDto> {
        this.logger.log({ msg: 'Register request', entity: 'Auth' });
        const command = RegisterMapper.toCommand(dto, correlationId);
        try {
            const result = await this.commandBus.execute(command);
            return RegisterMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }

            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }

            if (error instanceof ProviderError) {
                throw new HttpException(error.message, HttpStatus.BAD_GATEWAY);
            }

            this.logger.error({ msg: 'Error during register', entity: 'Auth', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Post('logout')
    @HttpCode(HttpStatus.OK)
    @ApiEndpoint({
        summary: 'Invalidate token (logout). Token is blacklisted until it expires.',
        body: LogoutRequestDto,
        response: { status: 200, type: LogoutResponseDto, description: 'Token invalidated' },
        errors: [
            { status: 400, description: 'Invalid payload' },
            { status: 401, description: 'Invalid or expired token' },
        ],
    })
    async logout(@Body() dto: LogoutRequestDto): Promise<LogoutResponseDto> {
        const command = LogoutMapper.toCommand(dto);
        try {
            const result = await this.commandBus.execute(command);
            return LogoutMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Error during logout', entity: 'Auth', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    @ApiEndpoint({
        summary: 'Refresh access token using a valid refresh token',
        body: RefreshTokenRequestDto,
        response: { status: 200, type: LoginResponseDto, description: 'New access and refresh tokens' },
        errors: [
            { status: 400, description: 'Invalid payload' },
            { status: 401, description: 'Invalid or expired refresh token' },
        ],
    })
    async refresh(@Body() dto: RefreshTokenRequestDto): Promise<LoginResponseDto> {
        const command = RefreshTokenMapper.toCommand(dto);
        try {
            const result = await this.commandBus.execute(command);
            return RefreshTokenMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Error during refresh', entity: 'Auth', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Post('validate')
    @HttpCode(HttpStatus.OK)
    @ApiEndpoint({
        summary: 'Validate a JWT token',
        body: ValidateTokenRequestDto,
        response: { status: 200, type: ValidateTokenResponseDto, description: 'Token validation result' },
        errors: [
            { status: 400, description: 'Invalid payload' },
            { status: 401, description: 'Invalid or expired token' },
        ],
    })
    async validate(@Body() dto: ValidateTokenRequestDto): Promise<ValidateTokenResponseDto> {
        const command = ValidateTokenMapper.toCommand(dto);
        try {
            const result = await this.commandBus.execute(command);
            return ValidateTokenMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }

            this.logger.error({ msg: 'Error during token validation', entity: 'Auth', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Post('change-password')
    @HttpCode(HttpStatus.OK)
    @ApiEndpoint({
        summary: 'Change password',
        description:
            'Verifies current password, hashes new password, and updates it in user-api. Flow: find user by email in user-api → verify current password → hash new password → PATCH user-api.',
        body: ChangePasswordRequestDto,
        response: { status: 200, type: ChangePasswordResponseDto, description: 'Password updated' },
        errors: [
            { status: 400, description: 'Invalid payload' },
            { status: 401, description: 'Current password is incorrect' },
            { status: 404, description: 'User not found' },
            { status: 502, description: 'User API error' },
        ],
    })
    async changePassword(
        @Body() dto: ChangePasswordRequestDto,
        @Headers('x-correlation-id') correlationId?: string,
    ): Promise<ChangePasswordResponseDto> {
        this.logger.log({ msg: 'Change password request', entity: 'Auth' });
        const command = ChangePasswordMapper.toCommand(dto, correlationId);
        try {
            const result = await this.commandBus.execute(command);
            return ChangePasswordMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }

            if (error instanceof ProviderError) {
                throw new HttpException(error.message, HttpStatus.BAD_GATEWAY);
            }

            this.logger.error({ msg: 'Error during change password', entity: 'Auth', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
