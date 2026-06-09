import { UserApiResponse, UserProfileResponse } from '@domain/types/user-api-response.type';

export interface RegisterUserPayload {
    name: string;
    email: string;
    password: string;
}

export interface RegisterUserApiResponse {
    id: string;
}

export abstract class IUserApiClient {
    abstract getUserByEmail(email: string, correlationId?: string): Promise<UserApiResponse | null>;
    abstract getUserById(userId: string, correlationId?: string): Promise<UserProfileResponse | null>;
    abstract getUserRoles(userId: string, correlationId?: string): Promise<string[]>;
    abstract registerUser(payload: RegisterUserPayload, correlationId?: string): Promise<RegisterUserApiResponse>;
    abstract updatePassword(userId: string, hashedNewPassword: string, correlationId?: string): Promise<void>;
}
