import { EntityError } from '@domain/errors/entity.error';

export class BaseUrlValueObject {
    public readonly value: string;

    constructor(value: string) {
        this.value = value?.trim();
        this.validate();
    }

    private validate(): void {
        if (!this.value) {
            throw new EntityError('Base URL is required', 'baseUrl');
        }

        if (this.value.length > 500) {
            throw new EntityError('Base URL must not exceed 500 characters', 'baseUrl');
        }

        try {
            new URL(this.value);
        } catch {
            throw new EntityError('Base URL must be a valid URL', 'baseUrl');
        }
    }
}
