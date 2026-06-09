import { plainToInstance, ClassConstructor } from 'class-transformer';
import { validate } from 'class-validator';

/**
 * Generic function to validate and sanitize a request body using a given DTO.
 * @param body The raw request body to validate and sanitize.
 * @param dtoClass The DTO class constructor to use for validation.
 * @returns A promise resolving to the sanitized and validated DTO instance.
 * @throws An error if validation fails.
 */
export async function sanitizeAndValidateBody<T extends object>(
    body: unknown,
    dtoClass: ClassConstructor<T>,
): Promise<T> {
    const dtoInstance = plainToInstance(dtoClass, body);

    const errors = await validate(dtoInstance, { whitelist: true, forbidNonWhitelisted: true });

    if (errors.length > 0) {
        throw new SanitizeBodyErrorException(errors.toString());
    }

    return dtoInstance;
}

export class SanitizeBodyErrorException extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SanitizeBodyErrorException';
    }
}
