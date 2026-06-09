let counter = 0;

export interface CreateSftpUserDto {
    username: string;
    password: string;
    rootDirectory: string;
}

export function buildCreateSftpUserDto(overrides?: Partial<CreateSftpUserDto>): CreateSftpUserDto {
    counter++;
    return {
        username: `test-user-${counter}`,
        password: 'password123',
        rootDirectory: `test-user-${counter}`,
        ...overrides,
    };
}
