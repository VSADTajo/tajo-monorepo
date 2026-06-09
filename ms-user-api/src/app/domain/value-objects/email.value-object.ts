import { EntityError } from '@domain/errors/entity.error';

export class EmailValueObject {
    constructor(public readonly value: string) {
        this.value = value.toLowerCase().trim();
        this.validate();
    }

    private validate(): void {
        if (!this.value) {
            throw new EntityError('Email is required');
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(this.value)) {
            throw new EntityError('Email format is invalid', 'email');
        }
    }
}
