import { EntityError } from '@domain/errors/entity.error';

export class RoleNameValueObject {
    public readonly value: string;

    constructor(value: string) {
        this.value = value.trim().toLowerCase();
        this.validate();
    }

    private validate(): void {
        if (!this.value) {
            throw new EntityError('Role name is required', 'name');
        }

        if (this.value.length > 50) {
            throw new EntityError('Role name must not exceed 50 characters', 'name');
        }

        if (!/^[a-z0-9_-]+$/.test(this.value)) {
            throw new EntityError(
                'Role name must contain only alphanumeric characters, hyphens, and underscores',
                'name',
            );
        }
    }
}
