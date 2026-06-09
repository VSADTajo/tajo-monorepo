import { EntityError } from '@domain/errors/entity.error';

export class SimulationDateValueObject {
    public readonly value: string;

    constructor(value: string) {
        // If ISO date string, convert to 14-digit format
        if (value && value.includes('-')) {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                const y = date.getUTCFullYear().toString();
                const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
                const d = date.getUTCDate().toString().padStart(2, '0');
                const h = date.getUTCHours().toString().padStart(2, '0');
                const min = date.getUTCMinutes().toString().padStart(2, '0');
                const s = date.getUTCSeconds().toString().padStart(2, '0');
                this.value = `${y}${m}${d}${h}${min}${s}`;
            } else {
                this.value = value;
            }
        } else {
            this.value = value ? value.trim() : value;
        }
        this.validate();
    }

    private validate(): void {
        if (!this.value) {
            throw new EntityError('Simulation date is required', 'simulationDate');
        }
        if (!/^\d{14}$/.test(this.value)) {
            throw new EntityError('Simulation date must be exactly 14 digits (YYYYMMDDHHMMSS)', 'simulationDate');
        }
    }
}
