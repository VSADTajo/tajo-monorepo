import { registerAs } from '@nestjs/config';
import { ServicesConfig } from './services-config.type';

import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import validateConfig from '@config/helpers/validate-config';

class EnvVariablesValidator {
    @IsNotEmpty()
    @IsString()
    AUTH_API_URL: string;

    @IsNotEmpty()
    @IsString()
    USER_API_URL: string;

    @IsNotEmpty()
    @IsString()
    SFTP_API_URL: string;

    @IsNotEmpty()
    @IsString()
    PREDICTIONS_API_URL: string;

    @IsNotEmpty()
    @IsString()
    HYDRO_API_URL: string;

    @IsNotEmpty()
    @IsString()
    NOTIFICATIONS_API_URL: string;

    @IsNotEmpty()
    @IsString()
    METEO_API_URL: string;

    // Optional with a default so an existing .env keeps booting: the model API
    // was reachable only from inside the network until the provider screens
    // needed it.
    @IsOptional()
    @IsString()
    MODEL_API_URL: string;
}

export default registerAs<ServicesConfig>('services', () => {
    validateConfig(process.env, EnvVariablesValidator);

    return {
        authApiUrl: process.env.AUTH_API_URL!,
        userApiUrl: process.env.USER_API_URL!,
        sftpApiUrl: process.env.SFTP_API_URL!,
        predictionsApiUrl: process.env.PREDICTIONS_API_URL!,
        hydroApiUrl: process.env.HYDRO_API_URL!,
        notificationsApiUrl: process.env.NOTIFICATIONS_API_URL!,
        meteoApiUrl: process.env.METEO_API_URL!,
        modelApiUrl: process.env.MODEL_API_URL || 'http://ms-model-api:3008',
    };
});
