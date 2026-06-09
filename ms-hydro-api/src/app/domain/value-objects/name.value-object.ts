import { EntityError } from '@domain/errors/entity.error';

export class NameValueObject {
    constructor(public readonly value: string) {
        this.value = value;
        this.validate();
    }

    validate(): void {
        if (!this.value) {
            throw new EntityError('Name is required');
        }
    }
}
