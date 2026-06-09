import { BadRequestException, ValidationError } from '@nestjs/common';

import { ValidationErrorCode, validationErrorMap } from '../validation-error-map';
import { FIELD_TAG_METADATA_KEY } from '../decorators/field-tag.decorator';

const DEFAULT_ERROR = {
    code: ValidationErrorCode.Default,
    message: 'Validation failed',
};

export class CustomValidationException extends BadRequestException {
    constructor(errors: ValidationError[]) {
        const formattedError = CustomValidationException.formatErrors(errors);

        super({
            StatusCode: 400,
            ErrorCode: formattedError.code,
            ErrorDescription: formattedError.message,
        });
    }

    private static formatErrors(errors: ValidationError[]): { code: string; message: string } {
        if (!errors.length) {
            return DEFAULT_ERROR;
        }

        const deepest = this.getDeepestConstraintError(errors[0]);

        if (!deepest?.constraints) {
            return DEFAULT_ERROR;
        }

        // Return only first error code mapped from Bamboo error codes
        const firstConstraintKey = Object.keys(deepest.constraints)[0];
        const property = deepest.property;
        const tag = deepest.target ? Reflect.getMetadata(FIELD_TAG_METADATA_KEY, deepest.target, property) : undefined;

        const code = validationErrorMap[tag || firstConstraintKey]?.code || ValidationErrorCode.Default;

        // Return class validator error message
        const constraints = deepest.constraints || {};
        const message = Object.values(constraints).join(', ');

        return { code, message };
    }

    private static getDeepestConstraintError(error: ValidationError): ValidationError | null {
        if (error.constraints) {
            return error;
        }

        if (error.children && error.children.length > 0) {
            for (const child of error.children) {
                const nested = this.getDeepestConstraintError(child);
                if (nested) return nested;
            }
        }

        return null;
    }
}
