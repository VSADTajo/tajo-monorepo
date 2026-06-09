let counter = 0;

export interface CreateSftpUserWithPathDto {
    username: string;
    password: string;
    rootDirectory: string;
}

export interface CreateSchemaForPathDto {
    directoryPath: string;
    name: string;
    inputFormat: string;
    outputFormat: string;
    fieldMappings: { sourceField: string; targetField: string; dataType: string }[];
    csvOptions: null;
}

export function buildSftpUserWithPath(overrides?: Partial<CreateSftpUserWithPathDto>): CreateSftpUserWithPathDto {
    counter++;
    return {
        username: `paths-user-${counter}`,
        password: 'password123',
        rootDirectory: `/data/files/user-${counter}`,
        ...overrides,
    };
}

export function buildSchemaForPath(
    directoryPath: string,
    overrides?: Partial<CreateSchemaForPathDto>,
): CreateSchemaForPathDto {
    counter++;
    return {
        directoryPath,
        name: `Schema for ${directoryPath}`,
        inputFormat: 'xml',
        outputFormat: 'json',
        fieldMappings: [{ sourceField: 'id', targetField: 'id', dataType: 'string' }],
        csvOptions: null,
        ...overrides,
    };
}
