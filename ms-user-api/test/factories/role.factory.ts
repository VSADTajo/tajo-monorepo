interface CreateRoleData {
    name: string;
    description?: string;
}

interface AssignRoleData {
    roleId: string;
}

/**
 * Genera datos válidos para crear un rol.
 * Cada llamada produce un nombre único.
 */
export function buildCreateRoleDto(overrides?: Partial<CreateRoleData>): CreateRoleData {
    return {
        name: `role-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        description: 'Test role description',
        ...overrides,
    };
}

/**
 * Genera datos válidos para asignar un rol a un usuario.
 */
export function buildAssignRoleDto(overrides?: Partial<AssignRoleData>): AssignRoleData {
    return {
        roleId: '00000000-0000-0000-0000-000000000000',
        ...overrides,
    };
}
