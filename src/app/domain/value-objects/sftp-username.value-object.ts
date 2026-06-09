import { EntityError } from '@domain/errors/entity.error';

export class SftpUsernameValueObject {
    public readonly value: string;

    constructor(username: string) {
        if (!username || !username.trim()) {
            throw new EntityError('Username is required', 'username');
        }

        const normalized = username.trim().toLowerCase();

        if (normalized.length > 100) {
            throw new EntityError('Username must be at most 100 characters', 'username');
        }

        if (!/^[a-z0-9_-]+$/.test(normalized)) {
            throw new EntityError(
                'Username must contain only lowercase letters, numbers, hyphens, and underscores',
                'username',
            );
        }

        this.value = normalized;
    }
}
