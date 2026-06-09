export interface AuthValidationResult {
    valid: boolean;
    userId?: string;
    roles?: string[];
}

export abstract class IAuthValidationService {
    abstract validate(token: string): Promise<AuthValidationResult>;
}
