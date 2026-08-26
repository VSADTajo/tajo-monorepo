import { Inject, Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import axios from 'axios';

import { NormalizedTimeSeriesResult } from '@domain/results/normalized-timeseries.result';
import { MappedSeries, mapPiJsonToNormalized } from '@infrastructure/services/pi-json.mapper';
import { WiskiTimeSeriesResult } from '@domain/results/wiski-timeseries.result';
import { ProviderError } from '@domain/errors/provider.error';
import { SftpApiConfigService } from '@config/sftp-api/sftp-api-config.service';
import { AppConfigService } from '@config/app/app-config.service';
import { VOBS_SOURCE } from '@config/app/app-config.type';
import { WiskiApiConfigService } from '@config/wiski-api/wiski-api-config.service';
import { parseWiskiCsv } from '@infrastructure/services/wiski-csv-parser';
import { WiskiObservedRecord, toWiskiTimeSeries } from '@infrastructure/services/wiski-json.mapper';

export interface SimulationFetchResult {
    timeSeries: NormalizedTimeSeriesResult[];
    processedFileName: string;
    /** Series dropped because every event carried missVal (not modelled by FEWS). */
    skippedEmptySeries: number;
    /** Series dropped because their shape could not be mapped. */
    skippedInvalidSeries: number;
}

@Injectable()
export class SimulationResultFetcherService {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly sftpApiConfigService: SftpApiConfigService,
        private readonly appConfigService?: AppConfigService,
        private readonly wiskiApiConfigService?: WiskiApiConfigService,
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

        let mapped: MappedSeries;
        try {
            const downloadResponse = await axios.get(`${baseUrl}/files/download`, {
                params: { path: file.path },
                responseType: 'json',
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                headers: { 'x-internal-caller': 'ms-model-api' },
            });

            mapped = mapPiJsonToNormalized(downloadResponse.data, (message, context) =>
                this.logger.warn({ msg: message, entity: 'SimulationResultFetcher', ...context }),
            );
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

        this.logger.log({
            msg: 'Parsed simulation result file',
            entity: 'SimulationResultFetcher',
            filePath: file.path,
            seriesKept: mapped.series.length,
            skippedEmptySeries: mapped.skippedEmptySeries,
            skippedInvalidSeries: mapped.skippedInvalidSeries,
        });

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

        return {
            timeSeries: mapped.series,
            processedFileName: file.name,
            skippedEmptySeries: mapped.skippedEmptySeries,
            skippedInvalidSeries: mapped.skippedInvalidSeries,
        };
    }

    /**
     * Fetches and parses the WISKI CSV from SFTP, returning parsed v.obs series.
     * Returns null and logs a warning on any failure. Never throws.
     */
    async fetchVobsSeries(simulationId: string): Promise<WiskiTimeSeriesResult[] | null> {
        if (this.appConfigService?.vobsSource === VOBS_SOURCE.WISKI_API) {
            return this.fetchVobsFromWiskiApi(simulationId);
        }

        return this.fetchVobsFromSftpCsv(simulationId);
    }

    /**
     * Reads the same observed series from their WISKI REST endpoint instead of
     * the CSV, resolving each variable through the catalog the ingestion path
     * already uses. The output shape is identical to parseWiskiCsv's, so the
     * poller and the calculator never learn the origin changed.
     *
     * Like the CSV path, any failure degrades to null: a simulation without
     * v.obs enrichment is worse than one with it, and better than none at all.
     */
    private async fetchVobsFromWiskiApi(simulationId: string): Promise<WiskiTimeSeriesResult[] | null> {
        const baseUrl = this.wiskiApiConfigService?.baseUrl ?? '';
        if (!baseUrl) {
            this.logger.warn({
                msg: 'VOBS_SOURCE=WISKI_API but the WISKI endpoint is not configured — skipping v.obs enrichment',
                entity: 'SimulationResultFetcher',
                simulationId,
            });
            return null;
        }

        const url = `${baseUrl.replace(/\/+$/, '')}${this.wiskiApiConfigService!.path}`;

        try {
            const response = await axios.get(url, {
                timeout: this.wiskiApiConfigService!.requestTimeoutMs,
                maxContentLength: this.wiskiApiConfigService!.maxResponseBytes,
                maxBodyLength: this.wiskiApiConfigService!.maxResponseBytes,
                responseType: 'json',
                headers: { Accept: 'application/json' },
            });

            const records = response.data;
            if (!Array.isArray(records)) {
                throw new Error(`expected a JSON array of readings, got ${typeof records}`);
            }

            const mapped = toWiskiTimeSeries(records as WiskiObservedRecord[], {
                sourceTimezone: this.wiskiApiConfigService!.timezone,
            });

            this.logger.log({
                msg: 'Fetched v.obs series from the WISKI API',
                entity: 'SimulationResultFetcher',
                simulationId,
                seriesCount: mapped.series.length,
                resolvedCount: mapped.resolvedCount,
                skippedCount: mapped.skippedVariables.length,
            });

            return mapped.series;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warn({
                msg: 'Failed to fetch v.obs from the WISKI API — publishing without v.obs enrichment',
                entity: 'SimulationResultFetcher',
                simulationId,
                url,
                error: message,
            });
            return null;
        }
    }


    private async fetchVobsFromSftpCsv(simulationId: string): Promise<WiskiTimeSeriesResult[] | null> {
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
}
