import { EntityError } from '@domain/errors/entity.error';

const PROVIDER_NAME_REGEX = /^[A-Z][A-Z0-9_]{1,31}$/;

/**
 * Provider name as it appears under tajo/METEO/<PROVIDER>/.
 * Always normalized to uppercase. Validates against a strict regex
 * to avoid path-traversal or unexpected characters.
 */
export class ProviderNameValueObject {
    public readonly value: string;

    constructor(input: string) {
        if (!input) {
            throw new EntityError('Provider name is required', 'provider');
        }
        this.value = input.trim().toUpperCase();
        this.validate();
    }

    private validate(): void {
        if (!PROVIDER_NAME_REGEX.test(this.value)) {
            throw new EntityError(
                `Invalid provider name: ${this.value} (must match ${PROVIDER_NAME_REGEX})`,
                'provider',
            );
        }
    }

    toString(): string {
        return this.value;
    }
}
