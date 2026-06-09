export interface JwtPayload {
    sub: string;
    roles: string[];
    type?: 'access' | 'refresh';
    iat?: number;
    exp?: number;
}

export interface RequestUser {
    userId: string;
    roles: string[];
}
