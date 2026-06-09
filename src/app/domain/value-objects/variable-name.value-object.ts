import { EntityError } from '@domain/errors/entity.error';

const VARIABLE_NAME_REGEX = /^[A-Za-z][A-Za-z0-9_]{1,63}$/;

/**
 * Variable name as it appears under tajo/METEO/<PROVIDER>/<VARIABLE>/.
 * Preserves the original casing (we display it back to consumers).
 * Has a `toSnakeCase()` helper used to derive the GeoServer layer suffix.
 */
export class VariableNameValueObject {
    public readonly value: string;

    constructor(input: string) {
        if (!input) {
            throw new EntityError('Variable name is required', 'variable');
        }
        this.value = input.trim();
        this.validate();
    }

    private validate(): void {
        if (!VARIABLE_NAME_REGEX.test(this.value)) {
            throw new EntityError(
                `Invalid variable name: ${this.value} (must match ${VARIABLE_NAME_REGEX})`,
                'variable',
            );
        }
    }

    /**
     * Convert "Precipitacion_25" → "precipitacion_25",
     *         "CoberturaNieve"  → "cobertura_nieve".
     */
    toSnakeCase(): string {
        return this.value
            .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
            .replace(/__+/g, '_')
            .toLowerCase();
    }

    toString(): string {
        return this.value;
    }
}
