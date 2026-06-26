import { EntityError } from '@domain/errors/entity.error';

/**
 * A single, safe SFTP file name (NOT a path).
 *
 * Blindaje against path traversal: the value must be a bare file name living directly
 * inside a simulation's `input`/`output` folder. Any separator, `..` segment, control
 * character or empty value is rejected. The server builds the full path from a validated
 * simulationId + folder enum + this name — the client never supplies a path.
 */
export class SftpFileNameValueObject {
    static readonly MAX_LENGTH = 255;
    // Letters, digits, dot, underscore, dash, space and parentheses — the charset real
    // simulation files use (e.g. `tagus_harmonie_Q_202606191200.json`).
    private static readonly ALLOWED = /^[A-Za-z0-9._()\- ]+$/;

    readonly value: string;

    constructor(value: string) {
        this.value = (value ?? '').trim();
        this.validate();
    }

    private validate(): void {
        if (!this.value) {
            throw new EntityError('File name is required', 'name');
        }
        if (this.value.length > SftpFileNameValueObject.MAX_LENGTH) {
            throw new EntityError('File name is too long', 'name');
        }
        if (this.value.includes('/') || this.value.includes('\\')) {
            throw new EntityError('File name must not contain path separators', 'name');
        }
        if (this.value.includes('..')) {
            throw new EntityError('File name must not contain traversal sequences', 'name');
        }
        if (!SftpFileNameValueObject.ALLOWED.test(this.value)) {
            throw new EntityError('File name contains invalid characters', 'name');
        }
    }
}
