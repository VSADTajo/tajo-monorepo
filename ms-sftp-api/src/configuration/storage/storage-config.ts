import { registerAs } from '@nestjs/config';
import { StorageConfig } from './storage-config.type';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import validateConfig from '@config/helpers/validate-config';

class EnvVariablesValidator {
    @IsNotEmpty()
    @IsString()
    STORAGE_BASE_PATH: string;

    @IsInt()
    @Min(1)
    @IsOptional()
    STORAGE_MAX_FILE_SIZE: number;
}

export default registerAs<StorageConfig>('storage', () => {
    validateConfig(process.env, EnvVariablesValidator);

    return {
        basePath: process.env.STORAGE_BASE_PATH!,
        maxFileSize: Number(process.env.STORAGE_MAX_FILE_SIZE) || 524288000,
    };
});
