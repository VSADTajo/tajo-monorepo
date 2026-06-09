import { Inject, Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import axios from 'axios';

import { IDataProvider } from '@domain/ports/data-provider.port';
import { ProviderConfig } from '@domain/entities/provider-config.entity';
import { NormalizedTimeSeriesResult, TimeSeriesEventResult } from '@domain/results/normalized-timeseries.result';
import { ProviderError } from '@domain/errors/provider.error';
import { SftpApiConfigService } from '@config/sftp-api/sftp-api-config.service';

@Injectable()
export class SftpFileProviderService implements IDataProvider {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly sftpApiConfigService: SftpApiConfigService,
    ) {}

    async fetch(config: ProviderConfig): Promise<NormalizedTimeSeriesResult[]> {
        const baseUrl = config.baseUrl || this.sftpApiConfigService.baseUrl;
        const settings = config.settings || {};
        const directory = String(settings.filePath);
        const filePrefix = String(settings.filePrefix);

        try {
            const listResponse = await axios.get(`${baseUrl}/files`, {
                params: { directory },
                headers: { 'x-internal-caller': 'ms-model-api' },
            });

            const files: { name: string; path: string }[] = listResponse.data.files.filter((f: any) => {
                const nameLower = f.name.toLowerCase();
                return !f.isDirectory && nameLower.startsWith(filePrefix.toLowerCase()) && nameLower.endsWith('.json');
            });

            if (files.length === 0) {
                this.logger.log(`No files to process in "${directory}" with prefix "${filePrefix}"`);
                return [];
            }

            this.logger.log(`Found ${files.length} files matching prefix "${filePrefix}" in "${directory}"`);

            const results: NormalizedTimeSeriesResult[] = [];

            for (const file of files) {
                try {
                    this.logger.log(`Processing file: ${file.path}`);

                    const downloadResponse = await axios.get(`${baseUrl}/files/download`, {
                        params: { path: file.path },
                        responseType: 'json',
                        maxContentLength: Infinity,
                        maxBodyLength: Infinity,
                        headers: { 'x-internal-caller': 'ms-model-api' },
                    });

                    const normalized = this.mapResponseToNormalized(downloadResponse.data);
                    results.push(...normalized);

                    // Move file to historial after successful processing
                    await axios.post(
                        `${baseUrl}/files/move`,
                        {
                            sourcePath: file.path,
                            destinationPath: `${directory}/historial/${file.name}`,
                            overwrite: true,
                        },
                        {
                            headers: { 'x-internal-caller': 'ms-model-api' },
                        },
                    );
                    this.logger.log(`Moved processed file to historial: ${file.name}`);
                } catch (fileError) {
                    const msg = fileError instanceof Error ? fileError.message : String(fileError);
                    this.logger.warn({
                        msg: 'Skipping corrupted/invalid file',
                        entity: 'Ingestion',
                        filePath: file.path,
                        error: msg,
                    });

                    // Move corrupted file out of source to prevent infinite reprocessing
                    try {
                        await axios.post(
                            `${baseUrl}/files/move`,
                            {
                                sourcePath: file.path,
                                destinationPath: `${directory}/corrupted/${file.name}`,
                                overwrite: true,
                            },
                            {
                                headers: { 'x-internal-caller': 'ms-model-api' },
                            },
                        );
                        this.logger.warn({
                            msg: 'Moved corrupted file to corrupted folder',
                            entity: 'Ingestion',
                            filePath: file.path,
                        });
                    } catch (moveError) {
                        const moveMsg = moveError instanceof Error ? moveError.message : String(moveError);
                        this.logger.warn({
                            msg: 'Failed to move corrupted file — it will be retried next cycle',
                            entity: 'Ingestion',
                            filePath: file.path,
                            error: moveMsg,
                        });
                    }
                }
            }

            return results;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`SFTP file fetch failed: ${message}`);
            throw new ProviderError(`SFTP file fetch failed: ${message}`);
        }
    }

    private mapResponseToNormalized(data: any): NormalizedTimeSeriesResult[] {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const seriesList = parsed.timeSeries;

        return seriesList.map((series: any) => {
            const { header, events } = series;
            const missVal = String(header.missVal);

            const mappedEvents: TimeSeriesEventResult[] = events.map((event: any) => {
                const isMissing = String(event.value) === missVal;

                return new TimeSeriesEventResult({
                    timestamp: `${event.date}T${event.time}Z`,
                    value: isMissing ? 0 : parseFloat(event.value),
                    flag: parseInt(event.flag, 10),
                    isMissing,
                });
            });

            return new NormalizedTimeSeriesResult({
                locationId: header.locationId,
                parameterId: header.parameterId,
                moduleInstanceId: header.moduleInstanceId,
                stationName: header.stationName,
                lat: parseFloat(header.lat),
                lon: parseFloat(header.lon),
                x: parseFloat(header.x),
                y: parseFloat(header.y),
                z: parseFloat(header.z),
                units: header.units,
                timeStep: { unit: header.timeStep.unit, multiplier: parseInt(header.timeStep.multiplier, 10) },
                forecastDate: `${header.forecastDate.date}T${header.forecastDate.time}Z`,
                startDate: `${header.startDate.date}T${header.startDate.time}Z`,
                endDate: `${header.endDate.date}T${header.endDate.time}Z`,
                events: mappedEvents,
            });
        });
    }
}
