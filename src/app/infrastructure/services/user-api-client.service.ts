import { Inject, Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import axios from 'axios';

import { IUserApiClient, RegisterUserApiResponse, RegisterUserPayload } from '@domain/ports/user-api-client.port';
import { UserApiResponse, UserProfileResponse } from '@domain/types/user-api-response.type';
import { UserApiConfigService } from '@config/user-api/user-api-config.service';
import { ProviderError } from '@domain/errors/provider.error';

@Injectable()
export class UserApiClientService implements IUserApiClient {
    private static readonly INTERNAL_CALLER_HEADER_VALUE = 'ms-authentication-api';

    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly userApiConfig: UserApiConfigService,
    ) {}

    async getUserByEmail(email: string, correlationId?: string): Promise<UserApiResponse | null> {
        const url = `${this.userApiConfig.url}/users/by-email/${encodeURIComponent(email)}`;
        this.logger.debug(`Fetching user by email from user-api: ${url}`);

        const headers: Record<string, string> = {
            'x-internal-caller': UserApiClientService.INTERNAL_CALLER_HEADER_VALUE,
        };
        if (correlationId) {
            headers['x-correlation-id'] = correlationId;
        }

        try {
            const response = await axios.get<UserApiResponse>(url, { headers });
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 404) {
                return null;
            }
            this.logger.error({
                msg: 'user-api call failed',
                entity: 'Auth',
                operation: 'getUserByEmail',
                error: String(error),
            });
            throw new ProviderError(`Failed to fetch user from user-api: ${error}`);
        }
    }

    /**
     * GET /users/:id — response shape must match user-api GetUserByIdResponseDto (id, name, email, status, welcomeEmailId).
     */
    async getUserById(userId: string, correlationId?: string): Promise<UserProfileResponse | null> {
        const url = `${this.userApiConfig.url}/users/${userId}`;
        this.logger.debug(`Fetching user by id from user-api: ${url}`);

        const headers: Record<string, string> = {
            'x-internal-caller': UserApiClientService.INTERNAL_CALLER_HEADER_VALUE,
        };
        if (correlationId) {
            headers['x-correlation-id'] = correlationId;
        }

        try {
            const response = await axios.get<UserProfileResponse>(url, { headers });
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 404) {
                return null;
            }
            this.logger.error({
                msg: 'user-api call failed',
                entity: 'Auth',
                operation: 'getUserById',
                error: String(error),
            });
            throw new ProviderError(`Failed to fetch user from user-api: ${error}`);
        }
    }

    async getUserRoles(userId: string, correlationId?: string): Promise<string[]> {
        const url = `${this.userApiConfig.url}/users/${userId}/roles`;
        this.logger.debug(`Fetching roles for user ${userId} from user-api`);

        const headers: Record<string, string> = {
            'x-internal-caller': UserApiClientService.INTERNAL_CALLER_HEADER_VALUE,
        };
        if (correlationId) {
            headers['x-correlation-id'] = correlationId;
        }

        try {
            const response = await axios.get<{ roles: Array<{ name: string }> }>(url, { headers });
            return response.data.roles.map((r) => r.name);
        } catch (error) {
            this.logger.error({
                msg: 'user-api call failed',
                entity: 'Auth',
                operation: 'getUserRoles',
                error: String(error),
            });
            throw new ProviderError(`Failed to fetch user roles from user-api: ${error}`);
        }
    }

    async registerUser(payload: RegisterUserPayload, correlationId?: string): Promise<RegisterUserApiResponse> {
        const url = `${this.userApiConfig.url}/users/register`;
        this.logger.debug(`Registering user via user-api: ${url}`);

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'x-internal-caller': UserApiClientService.INTERNAL_CALLER_HEADER_VALUE,
        };
        if (correlationId) {
            headers['x-correlation-id'] = correlationId;
        }

        try {
            const response = await axios.post<RegisterUserApiResponse>(url, payload, { headers });
            return response.data;
        } catch (error) {
            this.logger.error({
                msg: 'user-api call failed',
                entity: 'Auth',
                operation: 'registerUser',
                error: String(error),
            });
            throw new ProviderError(`Failed to register user via user-api: ${error}`);
        }
    }

    async updatePassword(userId: string, hashedNewPassword: string, correlationId?: string): Promise<void> {
        const url = `${this.userApiConfig.url}/users/${userId}/password`;
        this.logger.debug(`Updating password via user-api: ${url}`);

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'x-internal-caller': UserApiClientService.INTERNAL_CALLER_HEADER_VALUE,
        };
        if (correlationId) {
            headers['x-correlation-id'] = correlationId;
        }

        try {
            await axios.patch(url, { password: hashedNewPassword }, { headers });
        } catch (error) {
            this.logger.error({
                msg: 'user-api call failed',
                entity: 'Auth',
                operation: 'updatePassword',
                error: String(error),
            });
            throw new ProviderError(`Failed to update password via user-api: ${error}`);
        }
    }
}
