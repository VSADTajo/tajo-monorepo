import { EntityError } from '@domain/errors/entity.error';

export class PercentileValueObject {
    public readonly value: number;

    constructor(value: number) {
        this.value = value;
        this.validate();
    }

    private validate(): void {
        if (this.value === null || this.value === undefined) {
            throw new EntityError('Percentile is required', 'percentile');
        }
        if (this.value < 0.0 || this.value > 100.0) {
            throw new EntityError('Percentile must be between 0.0 and 100.0', 'percentile');
        }
    }
}
