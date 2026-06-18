import { Inject, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { IAuthValidationService, AuthValidationResult } from '@domain/ports/auth-validation.port';
import { ProviderError } from '@domain/errors/provider.error';
import { AuthApiConfigService } from '@config/auth-api/auth-api-config.service';

@Injectable()
export class AuthValidationService implements IAuthValidationService {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly authApiConfig: AuthApiConfigService,
    ) {}

    async validate(token: string): Promise<AuthValidationResult> {
        try {
            const response = await axios.post(
                `${this.authApiConfig.authApiUrl}/auth/validate`,
                { token },
                {
                    headers: { 'x-internal-caller': 'ms-sftp-api' },
                },
            );
            return {
                valid: response.data?.valid === true,
                userId: response.data?.userId,
                roles: response.data?.roles,
            };
        } catch (error) {
            this.logger.error({ msg: 'Auth validation failed', entity: 'Authentication', error: String(error) });
            throw new ProviderError('Authentication service unavailable');
        }
    }
}
