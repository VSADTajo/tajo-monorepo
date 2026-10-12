import { EntityError } from '@domain/errors/entity.error';

/**
 * Where an accumulated precipitation value comes from: the SAIH rain gauges
 * (observed) or one of the two meteorological forecasts.
 */
export enum PrecipAccumulationSource {
    OBSERVED = 'observed',
    HARMONIE = 'harmonie',
    EPS = 'eps',
}

/**
 * Accumulation horizons offered to the user. They match the horizons AEMET
 * defines rain warning thresholds for, so every value can be compared with one.
 */
export const PRECIP_ACCUMULATION_HOURS = [1, 2, 4, 8, 12, 24] as const;

export type PrecipAccumulationHours = (typeof PRECIP_ACCUMULATION_HOURS)[number];

const PREDICTION_TYPE_BY_SOURCE: Record<PrecipAccumulationSource, string> = {
    [PrecipAccumulationSource.OBSERVED]: 'WI__01.historical',
    [PrecipAccumulationSource.HARMONIE]: 'P.harmonie.forecast',
    [PrecipAccumulationSource.EPS]: 'P.ens.forecast',
};

/**
 * An observed station whose last measurement is older than this is not "live"
 * any more: its accumulation describes the past, not the current rain.
 */
const OBSERVED_STALE_AFTER_HOURS = 3;

const HOUR_MS = 60 * 60 * 1000;

/**
 * A precipitation accumulation request: which series and over how many hours.
 *
 * - observed: rain fallen in the last `hours` hours up to the station's last measurement.
 * - harmonie / eps: the highest rain the forecast expects over any `hours` consecutive hours.
 */
export class PrecipAccumulationWindowValueObject {
    public readonly source: PrecipAccumulationSource;
    public readonly hours: PrecipAccumulationHours;

    constructor(source: string, hours: number) {
        this.validate(source, hours);
        this.source = source as PrecipAccumulationSource;
        this.hours = hours as PrecipAccumulationHours;
    }

    get predictionType(): string {
        return PREDICTION_TYPE_BY_SOURCE[this.source];
    }

    get isObserved(): boolean {
        return this.source === PrecipAccumulationSource.OBSERVED;
    }

    /** Only observed data can go stale; a forecast describes the future by definition. */
    isStale(lastDate: Date, referenceDate: Date): boolean {
        if (!this.isObserved) return false;
        return referenceDate.getTime() - lastDate.getTime() > OBSERVED_STALE_AFTER_HOURS * HOUR_MS;
    }

    private validate(source: string, hours: number): void {
        if (!Object.values(PrecipAccumulationSource).includes(source as PrecipAccumulationSource)) {
            throw new EntityError(
                `Source must be one of: ${Object.values(PrecipAccumulationSource).join(', ')}`,
                'source',
            );
        }
        if (!PRECIP_ACCUMULATION_HOURS.includes(hours as PrecipAccumulationHours)) {
            throw new EntityError(`Hours must be one of: ${PRECIP_ACCUMULATION_HOURS.join(', ')}`, 'hours');
        }
    }
}
