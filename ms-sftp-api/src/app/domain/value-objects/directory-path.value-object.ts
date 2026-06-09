import { EntityError } from '@domain/errors/entity.error';

export class DirectoryPathValueObject {
    public readonly value: string;

    constructor(path: string) {
        if (!path || !path.trim()) {
            throw new EntityError('Directory path is required', 'directoryPath');
        }

        let normalized = path.trim();

        if (!normalized.startsWith('/')) {
            throw new EntityError('Directory path must start with /', 'directoryPath');
        }

        // Remove trailing slash unless it's the root path
        if (normalized.length > 1 && normalized.endsWith('/')) {
            normalized = normalized.replace(/\/+$/, '');
        }

        this.value = normalized;
    }
}
