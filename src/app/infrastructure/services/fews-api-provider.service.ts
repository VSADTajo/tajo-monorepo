import { Inject, Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import axios from 'axios';

import { IDataProvider } from '@domain/ports/data-provider.port';
import { ProviderConfig } from '@domain/entities/provider-config.entity';
import { NormalizedTimeSeriesResult, TimeSeriesEventResult } from '@domain/results/normalized-timeseries.result';
import { ProviderError } from '@domain/errors/provider.error';
import { FewsApiConfigService } from '@config/fews-api/fews-api-config.service';

@Injectable()
export class FewsApiProviderService implements IDataProvider {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly fewsApiConfigService: FewsApiConfigService,
    ) {}

    async fetch(config: ProviderConfig): Promise<NormalizedTimeSeriesResult[]> {
        const baseUrl = config.baseUrl || this.fewsApiConfigService.baseUrl;
        const settings = config.settings || {};

        const params: Record<string, string> = {
            documentFormat: 'PI_JSON',
        };

        if (settings.filterId) params.filterId = String(settings.filterId);
        if (settings.locationIds) params.locationIds = String(settings.locationIds);
        if (settings.parameterIds) params.parameterIds = String(settings.parameterIds);

        const url = `${baseUrl}/rest/fewspiservice/v1/timeseries`;

        this.logger.log(`Fetching FEWS API timeseries from ${url}`);

        try {
            const response = await axios.get(url, { params });
            const piJson = response.data;

            return this.mapPiJsonToNormalized(piJson);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`FEWS API fetch failed: ${message}`);
            throw new ProviderError(`FEWS API fetch failed: ${message}`);
        }
    }

    private mapPiJsonToNormalized(piJson: any): NormalizedTimeSeriesResult[] {
        const timeSeries = piJson?.timeSeries ?? [];

        return timeSeries.map((series: any) => {
            const header = series.header ?? {};
            const missVal = header.missVal !== undefined ? String(header.missVal) : undefined;

            const events: TimeSeriesEventResult[] = (series.events ?? []).map((event: any) => {
                const timestamp = this.combineDateTime(event.date, event.time);
                const value = parseFloat(event.value);
                const isMissing = missVal !== undefined && String(event.value) === missVal;

                return new TimeSeriesEventResult({
                    timestamp,
                    value: isMissing ? 0 : value,
                    flag: event.flag !== undefined ? parseInt(event.flag, 10) : 0,
                    isMissing,
                });
            });

            return new NormalizedTimeSeriesResult({
                locationId: header.locationId ?? '',
                parameterId: header.parameterId ?? '',
                moduleInstanceId: header.moduleInstanceId ?? '',
                stationName: header.stationName ?? '',
                lat: header.lat ?? 0,
                lon: header.lon ?? 0,
                x: header.x,
                y: header.y,
                z: header.z,
                units: header.units ?? '',
                timeStep: {
                    unit: header.timeStep?.unit ?? '',
                    multiplier: header.timeStep?.multiplier ?? 1,
                },
                forecastDate: header.forecastDate
                    ? this.combineDateTime(header.forecastDate.date, header.forecastDate.time)
                    : '',
                startDate: header.startDate ? this.combineDateTime(header.startDate.date, header.startDate.time) : '',
                endDate: header.endDate ? this.combineDateTime(header.endDate.date, header.endDate.time) : '',
                events,
            });
        });
    }

    private combineDateTime(date: string, time: string): string {
        if (!date) return '';
        if (!time) return new Date(date).toISOString();
        return new Date(`${date}T${time}Z`).toISOString();
    }
}
