import { EntityError } from '@domain/errors/entity.error';

export class FileExtensionsValueObject {
    public readonly value: string[];

    constructor(extensions: string[]) {
        if (!extensions || extensions.length === 0) {
            throw new EntityError('At least one file extension is required', 'extensions');
        }

        const normalized = extensions
            .map((ext) => {
                const trimmed = ext.trim().toLowerCase();
                return trimmed.startsWith('.') ? trimmed : `.${trimmed}`;
            })
            .filter((ext) => ext.length > 1); // filter out bare dots

        const deduplicated = [...new Set(normalized)];

        if (deduplicated.length === 0) {
            throw new EntityError('At least one valid file extension is required', 'extensions');
        }

        this.value = deduplicated;
    }
}
