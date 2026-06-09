import { Inject, Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import axios from 'axios';

import { IDataProvider } from '@domain/ports/data-provider.port';
import { ProviderConfig } from '@domain/entities/provider-config.entity';
import { NormalizedTimeSeriesResult, TimeSeriesEventResult } from '@domain/results/normalized-timeseries.result';
import { ProviderError } from '@domain/errors/provider.error';
import { SftpApiConfigService } from '@config/sftp-api/sftp-api-config.service';

// ─────────────────────────────────────────────────────────────
// Internal interfaces (in-memory only, not persisted)
// ─────────────────────────────────────────────────────────────

interface CsvEvent {
    readonly timestamp: string;
    readonly value: number;
    readonly isMissing: boolean;
}

interface CsvStationBlock {
    readonly stationSite: string;
    readonly stationName: string;
    readonly stationNumber: string;
    readonly localX: number;
    readonly localY: number;
    readonly parameterName: string;
    readonly parameterType: string;
    readonly parameterTypeName: string;
    readonly timeSeriesName: string;
    readonly timeSeriesUnit: string;
    readonly longitude: number;
    readonly latitude: number;
    readonly events: CsvEvent[];
}

const HEADER_KEYS = [
    'Station Site',
    'Station Name',
    'Station Number',
    'LocalX',
    'LocalY',
    'Datum',
    'Parameter Name',
    'Parameter Type',
    'Parameter Type Name',
    'Time series Name',
    'Time series Unit',
    'GlobalX',
    'GlobalY',
    'Longitude',
    'Latitude',
] as const;

const HEADER_LINE_COUNT = HEADER_KEYS.length;

const TIME_STEP_MAP: Record<string, { unit: string; multiplier: number }> = {
    Q: { unit: 'MINUTE', multiplier: 15 },
    Precip: { unit: 'MINUTE', multiplier: 60 },
};

@Injectable()
export class CsvFileProviderService implements IDataProvider {
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
                return !f.isDirectory && nameLower.startsWith(filePrefix.toLowerCase()) && nameLower.endsWith('.csv');
            });

            if (files.length === 0) {
                this.logger.log(`No CSV files to process in "${directory}" with prefix "${filePrefix}"`);
                return [];
            }

            this.logger.log(`Found ${files.length} CSV file(s) matching prefix "${filePrefix}" in "${directory}"`);

            const results: NormalizedTimeSeriesResult[] = [];

            for (const file of files) {
                try {
                    this.logger.log(`Processing CSV file: ${file.path}`);

                    const downloadResponse = await axios.get(`${baseUrl}/files/download`, {
                        params: { path: file.path },
                        responseType: 'arraybuffer',
                        maxContentLength: Infinity,
                        maxBodyLength: Infinity,
                        headers: { 'x-internal-caller': 'ms-model-api' },
                    });

                    const content = new TextDecoder('iso-8859-1').decode(downloadResponse.data);
                    const blocks = this.parseCsvBlocks(content);

                    this.logger.log(`Parsed ${blocks.length} station block(s) from "${file.name}"`);

                    let skippedBlocks = 0;
                    for (const block of blocks) {
                        try {
                            const normalized = this.mapBlockToNormalized(block);
                            results.push(normalized);
                        } catch (blockError) {
                            skippedBlocks++;
                            const msg = blockError instanceof Error ? blockError.message : String(blockError);
                            this.logger.warn({
                                msg: 'Skipping block for station',
                                entity: 'Ingestion',
                                stationNumber: block.stationNumber,
                                reason: msg,
                            });
                        }
                    }

                    if (skippedBlocks > 0) {
                        this.logger.warn(`Skipped ${skippedBlocks} block(s) in "${file.name}" due to errors`);
                    }

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
                    this.logger.log(`Moved processed CSV file to historial: ${file.name}`);
                } catch (fileError) {
                    const msg = fileError instanceof Error ? fileError.message : String(fileError);
                    this.logger.warn({
                        msg: 'Skipping corrupted/invalid CSV file',
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
                            msg: 'Moved corrupted CSV file to corrupted folder',
                            entity: 'Ingestion',
                            filePath: file.path,
                        });
                    } catch (moveError) {
                        const moveMsg = moveError instanceof Error ? moveError.message : String(moveError);
                        this.logger.warn({
                            msg: 'Failed to move corrupted CSV file — it will be retried next cycle',
                            entity: 'Ingestion',
                            filePath: file.path,
                            error: moveMsg,
                        });
                    }
                }
            }

            this.logger.log({
                msg: 'CSV ingestion complete',
                entity: 'Ingestion',
                seriesCount: results.length,
                fileCount: files.length,
            });
            return results;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error({ msg: 'CSV file fetch failed', entity: 'Ingestion', error: message });
            throw new ProviderError(`CSV file fetch failed: ${message}`);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // CSV Block Parser
    // ─────────────────────────────────────────────────────────────

    private parseCsvBlocks(content: string): CsvStationBlock[] {
        const lines = content.split(/\r?\n/);
        const blocks: CsvStationBlock[] = [];
        let currentHeaders: Record<string, string> = {};
        let currentEvents: CsvEvent[] = [];
        let headerLineIndex = 0;
        let inHeader = false;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (trimmed.startsWith('Station Site:')) {
                // Flush previous block if any
                if (Object.keys(currentHeaders).length > 0) {
                    const block = this.buildBlock(currentHeaders, currentEvents);
                    if (block) blocks.push(block);
                }
                currentHeaders = {};
                currentEvents = [];
                headerLineIndex = 0;
                inHeader = true;
            }

            if (inHeader && headerLineIndex < HEADER_LINE_COUNT) {
                const separatorIndex = trimmed.indexOf(':');
                if (separatorIndex !== -1) {
                    const key = trimmed.substring(0, separatorIndex).trim();
                    const value = trimmed.substring(separatorIndex + 1).trim();
                    currentHeaders[key] = value;
                }
                headerLineIndex++;
                if (headerLineIndex >= HEADER_LINE_COUNT) {
                    inHeader = false;
                }
                continue;
            }

            // Data line
            const event = this.parseDataLine(trimmed);
            if (event) {
                currentEvents.push(event);
            }
        }

        // Flush last block
        if (Object.keys(currentHeaders).length > 0) {
            const block = this.buildBlock(currentHeaders, currentEvents);
            if (block) blocks.push(block);
        }

        return blocks;
    }

    private buildBlock(headers: Record<string, string>, events: CsvEvent[]): CsvStationBlock | null {
        const stationNumber = headers['Station Number'];
        if (!stationNumber) return null;

        if (events.length === 0) {
            this.logger.warn({ msg: 'Skipping block — no data events', entity: 'Ingestion', stationNumber });
            return null;
        }

        return {
            stationSite: headers['Station Site'] || '',
            stationName: headers['Station Name'] || '',
            stationNumber,
            localX: parseFloat(headers.LocalX || '0'),
            localY: parseFloat(headers.LocalY || '0'),
            parameterName: headers['Parameter Name'] || '',
            parameterType: headers['Parameter Type'] || '',
            parameterTypeName: headers['Parameter Type Name'] || '',
            timeSeriesName: headers['Time series Name'] || '',
            timeSeriesUnit: headers['Time series Unit'] || '',
            longitude: parseFloat(headers.Longitude || '0'),
            latitude: parseFloat(headers.Latitude || '0'),
            events,
        };
    }

    // ─────────────────────────────────────────────────────────────
    // Data Line Parser
    // ─────────────────────────────────────────────────────────────

    private parseDataLine(line: string): CsvEvent | null {
        const parts = line.split(';');
        if (parts.length < 3) return null;

        const [datePart, timePart, valuePart] = parts;

        // Validate date format DD/MM/YYYY
        const dateSegments = datePart.split('/');
        if (dateSegments.length !== 3) return null;

        const [day, month, year] = dateSegments;
        if (!day || !month || !year) return null;

        const isoDate = `${year}-${month}-${day}`;
        const timestamp = `${isoDate}T${timePart}.000Z`;

        const rawValue = valuePart.trim();
        const isMissing = rawValue === '---' || rawValue === '' || isNaN(Number(rawValue));

        return {
            timestamp,
            value: isMissing ? 0 : parseFloat(rawValue),
            isMissing,
        };
    }

    // ─────────────────────────────────────────────────────────────
    // Block → NormalizedTimeSeriesResult Mapper
    // ─────────────────────────────────────────────────────────────

    private mapBlockToNormalized(block: CsvStationBlock): NormalizedTimeSeriesResult {
        const validEvents = block.events;
        if (validEvents.length === 0) {
            throw new Error(`Block for station "${block.stationNumber}" has no events`);
        }

        const firstTimestamp = validEvents[0].timestamp;
        const lastTimestamp = validEvents[validEvents.length - 1].timestamp;

        const seriesId = block.timeSeriesName.split('.')[0] || block.parameterType;
        if (!seriesId) {
            throw new Error(`Block for station "${block.stationNumber}" has no usable series identifier`);
        }
        const parameterId = `${seriesId}.historical`;
        const timeStep = TIME_STEP_MAP[block.parameterType] || { unit: 'MINUTE', multiplier: 15 };

        const mappedEvents = validEvents.map(
            (event) =>
                new TimeSeriesEventResult({
                    timestamp: event.timestamp,
                    value: event.value,
                    flag: event.isMissing ? 8 : 0,
                    isMissing: event.isMissing,
                }),
        );

        return new NormalizedTimeSeriesResult({
            locationId: block.stationNumber,
            parameterId,
            moduleInstanceId: 'FlowCast',
            stationName: block.stationName,
            lat: block.latitude,
            lon: block.longitude,
            x: block.localX,
            y: block.localY,
            units: block.timeSeriesUnit,
            timeStep,
            forecastDate: firstTimestamp,
            startDate: firstTimestamp,
            endDate: lastTimestamp,
            events: mappedEvents,
        });
    }
}
