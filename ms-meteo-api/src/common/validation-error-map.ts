// Define the error codes in an enum for reuse
export enum ValidationErrorCode {
    Default = 'TR999',
}

export const validationErrorMap: Record<string, { code: string }> = {};
