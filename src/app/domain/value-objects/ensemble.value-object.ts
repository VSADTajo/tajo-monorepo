import { EntityError } from '@domain/errors/entity.error';

export class EnsembleValueObject {
    public readonly value: string;

    constructor(value: string) {
        const trimmed = value ? value.trim() : value;
        // Pad numeric values to 3 digits
        if (trimmed && /^\d+$/.test(trimmed)) {
            this.value = trimmed.padStart(3, '0');
        } else {
            this.value = trimmed;
        }
        this.validate();
    }

    private validate(): void {
        if (!this.value) {
            throw new EntityError('Ensemble is required', 'ensemble');
        }
        if (this.value.length > 5) {
            throw new EntityError('Ensemble must not exceed 5 characters', 'ensemble');
        }
        if (!/^[a-zA-Z0-9]+$/.test(this.value)) {
            throw new EntityError('Ensemble must be alphanumeric', 'ensemble');
        }
    }
}
