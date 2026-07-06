import { Inject, Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import axios from 'axios';

import { NormalizedTimeSeriesResult, TimeSeriesEventResult } from '@domain/results/normalized-timeseries.result';
import { WiskiTimeSeriesResult } from '@domain/results/wiski-timeseries.result';
import { ProviderError } from '@domain/errors/provider.error';
import { SftpApiConfigService } from '@config/sftp-api/sftp-api-config.service';
import { AppConfigService } from '@config/app/app-config.service';
import { parseWiskiCsv } from '@infrastructure/services/wiski-csv-parser';

export interface SimulationFetchResult {
    timeSeries: NormalizedTimeSeriesResult[];
    processedFileName: string;
}

@Injectable()
export class SimulationResultFetcherService {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly sftpApiConfigService: SftpApiConfigService,
        private readonly appConfigService?: AppConfigService,
    ) {}

    /**
     * Fetches and parses the simulation result JSON from the output folder.
     * Returns null if no JSON files are found (result not yet available).
     * Throws ProviderError if the file is malformed (moves it to corrupted/).
     */
    async fetchFromFolder(outputFolder: string): Promise<SimulationFetchResult | null> {
        const baseUrl = this.sftpApiConfigService.baseUrl;

        let files: { name: string; path: string }[];
        try {
            const listResponse = await axios.get(`${baseUrl}/files`, {
                params: { directory: outputFolder },
                headers: { 'x-internal-caller': 'ms-model-api' },
            });

            files = (listResponse.data.files as any[]).filter((f: any) => {
                const nameLower = (f.name as string).toLowerCase();
                return !f.isDirectory && nameLower.endsWith('.json');
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error({
                msg: 'Failed to list files from SFTP output folder',
                entity: 'SimulationResultFetcher',
                outputFolder,
                error: message,
            });
            throw new ProviderError(`Failed to list files from output folder "${outputFolder}": ${message}`);
        }

        if (files.length === 0) {
            this.logger.log(`No JSON files found in output folder "${outputFolder}" — result not yet available`);
            return null;
        }

        // Process only the first JSON file found
        const file = files[0];
        this.logger.log(`Processing simulation result file: ${file.path}`);

        let timeSeries: NormalizedTimeSeriesResult[];
        try {
            const downloadResponse = await axios.get(`${baseUrl}/files/download`, {
                params: { path: file.path },
                responseType: 'json',
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                headers: { 'x-internal-caller': 'ms-model-api' },
            });

            timeSeries = this.mapResponseToNormalized(downloadResponse.data);
        } catch (parseError) {
            const message = parseError instanceof Error ? parseError.message : String(parseError);
            this.logger.error({
                msg: 'Failed to parse simulation result file — moving to corrupted/',
                entity: 'SimulationResultFetcher',
                filePath: file.path,
                error: message,
            });

            // Move corrupted file to prevent infinite retries
            try {
                await axios.post(
                    `${baseUrl}/files/move`,
                    {
                        sourcePath: file.path,
                        destinationPath: `${outputFolder}/corrupted/${file.name}`,
                        overwrite: true,
                    },
                    { headers: { 'x-internal-caller': 'ms-model-api' } },
                );
                this.logger.warn({
                    msg: 'Moved corrupted simulation result to corrupted/',
                    entity: 'SimulationResultFetcher',
                    filePath: file.path,
                });
            } catch (moveError) {
                const moveMsg = moveError instanceof Error ? moveError.message : String(moveError);
                this.logger.warn({
                    msg: 'Failed to move corrupted file — it will be retried next poll cycle',
                    entity: 'SimulationResultFetcher',
                    filePath: file.path,
                    error: moveMsg,
                });
            }

            throw new ProviderError(`Failed to parse simulation result file "${file.path}": ${message}`);
        }

        // Move successfully processed file to historial/
        try {
            await axios.post(
                `${baseUrl}/files/move`,
                {
                    sourcePath: file.path,
                    destinationPath: `${outputFolder}/historial/${file.name}`,
                    overwrite: true,
                },
                { headers: { 'x-internal-caller': 'ms-model-api' } },
            );
            this.logger.log(`Moved processed simulation result to historial: ${file.name}`);
        } catch (moveError) {
            const moveMsg = moveError instanceof Error ? moveError.message : String(moveError);
            this.logger.warn({
                msg: 'Failed to move processed file to historial — continuing without move',
                entity: 'SimulationResultFetcher',
                filePath: file.path,
                error: moveMsg,
            });
        }

        return { timeSeries, processedFileName: file.name };
    }

    /**
     * Fetches and parses the WISKI CSV from SFTP, returning parsed v.obs series.
     * Returns null and logs a warning on any failure. Never throws.
     */
    async fetchVobsSeries(simulationId: string): Promise<WiskiTimeSeriesResult[] | null> {
        const path = this.appConfigService?.vobsCsvSftpPath ?? '';
        if (!path) {
            this.logger.warn({
                msg: 'VOBS_CSV_SFTP_PATH not configured — skipping v.obs enrichment',
                entity: 'SimulationResultFetcher',
                simulationId,
            });
            return null;
        }

        try {
            const baseUrl = this.sftpApiConfigService.baseUrl;
            const timeout = this.appConfigService?.vobsCsvFetchTimeoutMs ?? 30_000;
            const response = await axios.get(`${baseUrl}/files/download`, {
                params: { path },
                responseType: 'arraybuffer',
                timeout,
                headers: { 'x-internal-caller': 'ms-model-api' },
            });
            const csvText = this.decodeCsvBuffer(response.data as Buffer);
            const timezone = this.appConfigService?.vobsCsvTimezone ?? 'UTC';
            return parseWiskiCsv(csvText, { sourceTimezone: timezone });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warn({
                msg: 'Failed to fetch or parse WISKI CSV — publishing without v.obs enrichment',
                entity: 'SimulationResultFetcher',
                simulationId,
                path,
                error: message,
            });
            return null;
        }
    }

    private decodeCsvBuffer(buffer: Buffer): string {
        try {
            return buffer.toString('utf-8');
        } catch {
            return buffer.toString('latin1');
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
                lat: parseFloat(header.lat) || 0,
                lon: parseFloat(header.lon) || 0,
                x: parseFloat(header.x) || 0,
                y: parseFloat(header.y) || 0,
                z: parseFloat(header.z) || 0,
                units: header.units,
                timeStep: {
                    unit: header.timeStep?.unit || 'hour',
                    multiplier: parseInt(header.timeStep?.multiplier || '1', 10),
                },
                forecastDate: `${header.forecastDate.date}T${header.forecastDate.time}Z`,
                startDate: `${header.startDate.date}T${header.startDate.time}Z`,
                endDate: `${header.endDate.date}T${header.endDate.time}Z`,
                events: mappedEvents,
            });
        });
    }
}
