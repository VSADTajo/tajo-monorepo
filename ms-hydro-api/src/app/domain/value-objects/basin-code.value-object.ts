import { EntityError } from '@domain/errors/entity.error';

export class BasinCodeValueObject {
    public readonly value: string;

    constructor(value: string) {
        this.value = (value ?? '').trim().toUpperCase();
        this.validate();
    }

    private validate(): void {
        if (!this.value) {
            throw new EntityError('Code is required', 'code');
        }
        if (this.value.length > 20) {
            throw new EntityError('Code must be at most 20 characters', 'code');
        }
        if (!/^[A-Z0-9/_-]+$/.test(this.value)) {
            throw new EntityError('Code must contain only letters, numbers, hyphens, underscores, and slashes', 'code');
        }
    }
}
