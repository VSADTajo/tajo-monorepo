interface RegisterUserData {
    name: string;
    email: string;
    password: string;
}

export interface UpdateUserData {
    name?: string;
    email?: string;
}

/**
 * Genera datos válidos para POST /users/register (llamado por AUTH-API con password hasheada).
 * Cada llamada produce un email único.
 */
export function buildRegisterUserDto(overrides?: Partial<RegisterUserData>): RegisterUserData {
    return {
        name: 'John Doe',
        email: `user-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
        password: '$2b$10$dummyhashedpassword',
        ...overrides,
    };
}

/**
 * Genera datos válidos para PATCH /users/:id.
 * name y email son opcionales.
 */
export function buildUpdateUserDto(overrides?: Partial<UpdateUserData>): UpdateUserData {
    return {
        name: 'Jane Updated',
        email: `updated-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
        ...overrides,
    };
}
