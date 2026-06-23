import * as path from 'node:path';
import { EntityError } from '@domain/errors/entity.error';

export class FilePathValueObject {
    public readonly absolutePath: string;
    public readonly relativePath: string;

    constructor(relativePath: string, basePath: string) {
        if (!relativePath || !relativePath.trim()) {
            throw new EntityError('File path is required', 'path');
        }

        if (relativePath.includes('\0')) {
            throw new EntityError('File path contains invalid characters', 'path');
        }

        const normalized = relativePath.trim().replace(/\\/g, '/');
        const resolved = path.resolve(basePath, normalized);

        // Guard against path-prefix overlap (e.g. basePath="/data/storage" must NOT
        // accept "/data/storage-evil"): require an exact match or a real path-separator boundary.
        if (resolved !== basePath && !resolved.startsWith(basePath + path.sep)) {
            throw new EntityError('Invalid path: access outside base directory is not allowed', 'path');
        }

        this.absolutePath = resolved;
        this.relativePath = path.relative(basePath, resolved);
    }
}
