import { EntityError } from '@domain/errors/entity.error';
import { ProviderType } from '@domain/types/provider-type.enum';

export class ProviderTypeValueObject {
    public readonly value: ProviderType;

    constructor(value: string) {
        this.value = value as ProviderType;
        this.validate();
    }

    private validate(): void {
        if (!this.value) {
            throw new EntityError('Provider type is required', 'type');
        }

        if (!Object.values(ProviderType).includes(this.value)) {
            throw new EntityError(`Provider type must be one of: ${Object.values(ProviderType).join(', ')}`, 'type');
        }
    }
}
