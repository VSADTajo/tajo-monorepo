import { registerAs } from '@nestjs/config';
import { UserApiConfig } from './user-api-config.type';

import { IsNotEmpty, IsString } from 'class-validator';
import validateConfig from '@config/helpers/validate-config';

class EnvVariablesValidator {
    @IsNotEmpty()
    @IsString()
    USER_API_URL: string;
}

export default registerAs<UserApiConfig>('user-api', () => {
    validateConfig(process.env, EnvVariablesValidator);

    return {
        url: process.env.USER_API_URL!,
    };
});
