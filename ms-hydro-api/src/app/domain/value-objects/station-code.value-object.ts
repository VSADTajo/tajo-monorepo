import { EntityError } from '@domain/errors/entity.error';

export class StationCodeValueObject {
    public readonly value: string;

    constructor(value: string) {
        this.value = (value ?? '').trim().toUpperCase();
        this.validate();
    }

    private validate(): void {
        if (!this.value) {
            throw new EntityError('Station code is required', 'stationCode');
        }
        if (this.value.length > 50) {
            throw new EntityError('Station code must be at most 50 characters', 'stationCode');
        }
        if (!/^[A-Z0-9/_-]+$/.test(this.value)) {
            throw new EntityError(
                'Station code must contain only letters, numbers, hyphens, underscores, and slashes',
                'stationCode',
            );
        }
    }
}
