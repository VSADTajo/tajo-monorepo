import { AerialPrecipitationSeries } from '@domain/entities/aerial-precipitation-series.entity';

/**
 * Result returned by the paginated list query (ListAerialPrecipitationQuery).
 */
export class AerialPrecipitationListResult {
    readonly data: AerialPrecipitationSeries[];
    readonly total: number;
    readonly page: number;
    readonly limit: number;

    constructor(params: { data: AerialPrecipitationSeries[]; total: number; page: number; limit: number }) {
        this.data = params.data;
        this.total = params.total;
        this.page = params.page;
        this.limit = params.limit;
    }
}

/**
 * Result returned by the "latest per polygon" query (GetAerialPrecipitationLatestQuery).
 * One series per polygon matching the layer/provider/accumulation filter.
 */
export class AerialPrecipitationLatestResult {
    readonly series: AerialPrecipitationSeries[];

    constructor(params: { series: AerialPrecipitationSeries[] }) {
        this.series = params.series;
    }
}

/**
 * Result returned by the "by-location" query (GetAerialPrecipitationByLocationQuery).
 * All active series for one polygon, optionally filtered by provider/accumulation/date range.
 * Grouping by (provider, accumulation, stat) is performed in the mapper layer.
 */
export class AerialPrecipitationByLocationResult {
    readonly locationId: string;
    readonly series: AerialPrecipitationSeries[];

    constructor(params: { locationId: string; series: AerialPrecipitationSeries[] }) {
        this.locationId = params.locationId;
        this.series = params.series;
    }
}
