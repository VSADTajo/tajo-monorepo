import { EntityError } from '@domain/errors/entity.error';

export class PollingIntervalValueObject {
    public readonly value: number;

    constructor(value: number) {
        this.value = value;
        this.validate();
    }

    private validate(): void {
        if (this.value === undefined || this.value === null) {
            throw new EntityError('Polling interval is required', 'pollingIntervalMinutes');
        }

        if (!Number.isInteger(this.value)) {
            throw new EntityError('Polling interval must be an integer', 'pollingIntervalMinutes');
        }

        if (this.value < 5) {
            throw new EntityError('Polling interval must be at least 5 minutes', 'pollingIntervalMinutes');
        }
    }
}
