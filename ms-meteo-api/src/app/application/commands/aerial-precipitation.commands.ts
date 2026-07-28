import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

import { IAerialPrecipitationSeriesRepository } from '@domain/ports/aerial-precipitation-series-repository.port';
import { ISftpFileClient } from '@domain/ports/sftp-file-client.port';
import { ICacheService } from '@domain/ports/cache-service.port';
import { AerialPrecipitationSeries } from '@domain/entities/aerial-precipitation-series.entity';
import { AerialPrecipitationEvent } from '@domain/entities/aerial-precipitation-event.entity';
import { ParameterIdValueObject } from '@domain/value-objects/parameter-id.value-object';
import { AerialPrecipitationIngestRunResult } from '@domain/results/aerial-precipitation-ingest.result';
import { AerialPrecipitationCacheKeys } from '@infrastructure/cache/cache-config.registry';

// ─────────────────────────────────────────────────────────────
// Shared FEWS JSON types
// ─────────────────────────────────────────────────────────────

interface FewsDateTime {
    date: string;
    time: string;
}

interface FewsHeader {
    type?: string;
    moduleInstanceId?: string;
    locationId: string;
    parameterId: string;
    timeStep?: { unit?: string; multiplier?: string };
    startDate?: FewsDateTime;
    endDate?: FewsDateTime;
    forecastDate?: FewsDateTime;
    missVal?: string;
    stationName?: string;
    lat?: string;
    lon?: string;
    units?: string;
    creationDate?: string;
    creationTime?: string;
    approvedDate?: FewsDateTime;
}

interface FewsEvent {
    date: string;
    time: string;
    value: string;
    flag: string;
}

interface FewsTimeSeries {
    header: FewsHeader;
    events?: FewsEvent[];
}

interface FewsPayload {
    version?: string;
    timeZone?: string;
    timeSeries?: FewsTimeSeries[];
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function parseFewsDateTime(dt: FewsDateTime | undefined): Date | null {
    if (!dt?.date || !dt?.time) return null;
    return new Date(`${dt.date}T${dt.time}Z`);
}

function parseFewsCreationDate(date?: string, time?: string): Date | null {
    if (!date) return null;
    const t = time ?? '00:00:00';
    return new Date(`${date}T${t}Z`);
}

// ─────────────────────────────────────────────────────────────
// PollAerialPrecipitation
// ─────────────────────────────────────────────────────────────

export interface IPollAerialPrecipitationCommand {
    /** SFTP directory to poll (defaults to config if not provided). */
    sftpDirectory: string;
    /** Whitelisted filename prefixes (passed from config). */
    filePrefixes?: string[];
}

export class PollAerialPrecipitationCommand {
    constructor(private readonly parameters: IPollAerialPrecipitationCommand) {}

    get sftpDirectory(): string {
        return this.parameters.sftpDirectory;
    }

    get filePrefixes(): string[] | undefined {
        return this.parameters.filePrefixes;
    }
}

@CommandHandler(PollAerialPrecipitationCommand)
export class PollAerialPrecipitationHandler implements ICommandHandler<
    PollAerialPrecipitationCommand,
    AerialPrecipitationIngestRunResult
> {
    /** Default accepted file prefixes (overridden by command if provided). */
    private static readonly DEFAULT_PREFIXES = ['tagus_eps_Pareal_', 'tagus_harmonie_Pareal_', 'tagus_saih_Pareal_'];

    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly aerialPrecipRepo: IAerialPrecipitationSeriesRepository,
        private readonly sftpClient: ISftpFileClient,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: PollAerialPrecipitationCommand): Promise<AerialPrecipitationIngestRunResult> {
        const startedAt = Date.now();

        // --- Try to acquire advisory lock ---
        const lockAcquired = await this.aerialPrecipRepo.acquirePollAdvisoryLock();
        if (!lockAcquired) {
            this.logger.log({ msg: 'aerial-precipitation poll skipped — lock held by another process' });
            return new AerialPrecipitationIngestRunResult({
                filesProcessed: 0,
                filesFailed: 0,
                seriesPersisted: 0,
                eventsPersisted: 0,
                seriesSkipped: 0,
                durationMs: Date.now() - startedAt,
                runId: 'skipped',
            });
        }

        let filesProcessed = 0;
        let filesFailed = 0;
        let seriesPersisted = 0;
        let eventsPersisted = 0;
        let seriesSkipped = 0;

        try {
            const prefixes = command.filePrefixes ?? PollAerialPrecipitationHandler.DEFAULT_PREFIXES;
            const entries = await this.sftpClient.listDirectory(command.sftpDirectory);

            // Filter: must match a prefix AND end with .json AND not be a directory
            const candidates = entries.filter((e) => {
                if (e.isDirectory) return false;
                if (!e.name.endsWith('.json')) return false;
                return prefixes.some((p) => e.name.startsWith(p));
            });

            this.logger.log({
                msg: `aerial-precipitation poll: found ${candidates.length} candidate file(s)`,
                directory: command.sftpDirectory,
            });

            for (const entry of candidates) {
                filesProcessed++;
                const sourcePath = entry.path;
                const baseName = entry.name;

                let rawText: string;
                try {
                    // Use download() instead of readText() — EPS Pareal files can exceed
                    // the sftp-api /files/read size limit (they hit 413 in prod at ~4-5MB).
                    // download() returns a raw Buffer with no size guardrail; we decode
                    // as UTF-8 since FEWS JSON is text.
                    const buf = await this.sftpClient.download(sourcePath);
                    rawText = buf.toString('utf8');
                } catch (readErr) {
                    this.logger.warn({
                        msg: 'aerial-precipitation: failed to read file, skipping',
                        file: baseName,
                        error: (readErr as Error).message,
                    });
                    filesFailed++;
                    await this.moveToFailed(command.sftpDirectory, sourcePath, baseName);
                    continue;
                }

                let payload: FewsPayload;
                try {
                    payload = JSON.parse(rawText) as FewsPayload;
                } catch (_parseErr) {
                    this.logger.warn({
                        msg: 'aerial-precipitation: malformed JSON, moving to failed',
                        file: baseName,
                    });
                    filesFailed++;
                    await this.moveToFailed(command.sftpDirectory, sourcePath, baseName);
                    continue;
                }

                // Process each timeSeries in the file
                const { persisted, skipped, eventsCount } = await this.processTimeSeries(payload, baseName);
                seriesPersisted += persisted;
                seriesSkipped += skipped;
                eventsPersisted += eventsCount;

                // Move file to historial/ regardless of partial skips
                await this.moveToArchive(command.sftpDirectory, sourcePath, baseName);
            }

            // Invalidate cache if anything was persisted
            if (seriesPersisted > 0) {
                await this.cacheService.delByPattern(AerialPrecipitationCacheKeys.pattern());
                this.logger.log({ msg: 'aerial-precipitation cache invalidated after ingest' });
            }
        } finally {
            await this.aerialPrecipRepo.releasePollAdvisoryLock();
        }

        const result = new AerialPrecipitationIngestRunResult({
            filesProcessed,
            filesFailed,
            seriesPersisted,
            eventsPersisted,
            seriesSkipped,
            durationMs: Date.now() - startedAt,
            runId: `poll-${Date.now()}`,
        });

        this.logger.log({
            msg: 'aerial-precipitation poll complete',
            filesProcessed,
            filesFailed,
            seriesPersisted,
            eventsPersisted,
            seriesSkipped,
            durationMs: result.durationMs,
        });

        return result;
    }

    // ─── Private helpers ──────────────────────────────────────────

    private async processTimeSeries(
        payload: FewsPayload,
        sourceFileName: string,
    ): Promise<{ persisted: number; skipped: number; eventsCount: number }> {
        let persisted = 0;
        let skipped = 0;
        let eventsCount = 0;

        for (const ts of payload.timeSeries ?? []) {
            const header = ts.header;
            if (!header?.parameterId || !header?.locationId) {
                skipped++;
                continue;
            }

            // Parse parameterId — skip on invalid
            let paramVo: ParameterIdValueObject;
            try {
                paramVo = new ParameterIdValueObject(header.parameterId);
            } catch (err) {
                this.logger.warn({
                    msg: 'aerial-precipitation: invalid parameterId — skipping series',
                    parameterId: header.parameterId,
                    locationId: header.locationId,
                    error: (err as Error).message,
                });
                skipped++;
                continue;
            }

            const missVal = header.missVal !== undefined ? parseFloat(header.missVal) : -999;
            const forecastDateRaw = parseFewsDateTime(header.forecastDate);
            if (!forecastDateRaw) {
                this.logger.warn({
                    msg: 'aerial-precipitation: missing forecastDate — skipping series',
                    parameterId: header.parameterId,
                    locationId: header.locationId,
                });
                skipped++;
                continue;
            }

            const series = new AerialPrecipitationSeries({
                locationId: header.locationId,
                parameterId: header.parameterId,
                forecastDate: forecastDateRaw,
                provider: paramVo.provider,
                layer: paramVo.layer,
                stat: paramVo.stat,
                accumulation: paramVo.accumulation,
                moduleInstanceId: header.moduleInstanceId ?? null,
                stationName: header.stationName ?? null,
                lat: header.lat !== undefined ? parseFloat(header.lat) : null,
                lon: header.lon !== undefined ? parseFloat(header.lon) : null,
                startDate: parseFewsDateTime(header.startDate),
                endDate: parseFewsDateTime(header.endDate),
                units: header.units ?? 'mm',
                missVal,
                timeStepSeconds:
                    header.timeStep?.multiplier !== undefined ? parseInt(header.timeStep.multiplier, 10) : 3600,
                creationDate: parseFewsCreationDate(header.creationDate, header.creationTime),
                approvedDate: parseFewsDateTime(header.approvedDate),
                sourceFileName,
            });

            try {
                series.validate();
            } catch (err) {
                this.logger.warn({
                    msg: 'aerial-precipitation: entity validation failed — skipping series',
                    parameterId: header.parameterId,
                    locationId: header.locationId,
                    error: (err as Error).message,
                });
                skipped++;
                continue;
            }

            // Build filtered events (missVal and flag !== '2' are excluded)
            const events: AerialPrecipitationEvent[] = (ts.events ?? [])
                .filter((e) => {
                    const val = parseFloat(e.value);
                    if (val === missVal) return false;
                    if (e.flag !== '2') return false;
                    return true;
                })
                .map((e) => {
                    const eventDate = new Date(`${e.date}T${e.time}Z`);
                    return new AerialPrecipitationEvent({
                        eventDate,
                        value: parseFloat(e.value),
                        flag: parseInt(e.flag, 10),
                    });
                });

            try {
                await this.aerialPrecipRepo.upsertWithEvents(series, events);
                persisted++;
                eventsCount += events.length;
            } catch (err) {
                this.logger.error({
                    msg: 'aerial-precipitation: failed to upsert series',
                    parameterId: header.parameterId,
                    locationId: header.locationId,
                    error: (err as Error).message,
                });
                skipped++;
            }
        }

        return { persisted, skipped, eventsCount };
    }

    private async moveToArchive(sftpDirectory: string, sourcePath: string, baseName: string): Promise<void> {
        const historialDir = `${sftpDirectory}/historial`;
        const destPath = `${historialDir}/${baseName}`;
        try {
            await this.sftpClient.move(sourcePath, destPath, true);
        } catch (err) {
            this.logger.warn({
                msg: 'aerial-precipitation: failed to move file to historial',
                sourcePath,
                destPath,
                error: (err as Error).message,
            });
        }
    }

    private async moveToFailed(sftpDirectory: string, sourcePath: string, baseName: string): Promise<void> {
        // Aligns with model-api convention: bad files land in <dir>/corrupted/<name>.
        // Timestamp-suffixed to avoid collisions if the same filename gets re-uploaded broken.
        const corruptedDir = `${sftpDirectory}/corrupted`;
        const destPath = `${corruptedDir}/${baseName}.${Date.now()}`;
        try {
            await this.sftpClient.move(sourcePath, destPath, true);
        } catch (err) {
            this.logger.warn({
                msg: 'aerial-precipitation: failed to move corrupted file',
                sourcePath,
                destPath,
                error: (err as Error).message,
            });
        }
    }
}

// ─────────────────────────────────────────────────────────────
// PurgeOldAerialPrecipitation
// ─────────────────────────────────────────────────────────────

export interface IPurgeOldAerialPrecipitationCommand {
    /** Explicit cutoff date. If not provided, handler derives from retentionDays. */
    cutoff?: Date;
    /** Number of retention days (used when cutoff is not provided). */
    retentionDays?: number;
}

export class PurgeOldAerialPrecipitationCommand {
    constructor(private readonly parameters: IPurgeOldAerialPrecipitationCommand = {}) {}

    get cutoff(): Date | undefined {
        return this.parameters.cutoff;
    }

    get retentionDays(): number | undefined {
        return this.parameters.retentionDays;
    }
}

export class PurgeOldAerialPrecipitationResult {
    readonly deletedCount: number;

    constructor(params: { deletedCount: number }) {
        this.deletedCount = params.deletedCount;
    }
}

@CommandHandler(PurgeOldAerialPrecipitationCommand)
export class PurgeOldAerialPrecipitationHandler implements ICommandHandler<
    PurgeOldAerialPrecipitationCommand,
    PurgeOldAerialPrecipitationResult
> {
    private static readonly DEFAULT_RETENTION_DAYS = 30;

    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly aerialPrecipRepo: IAerialPrecipitationSeriesRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: PurgeOldAerialPrecipitationCommand): Promise<PurgeOldAerialPrecipitationResult> {
        const cutoff =
            command.cutoff ??
            new Date(
                Date.now() -
                    (command.retentionDays ?? PurgeOldAerialPrecipitationHandler.DEFAULT_RETENTION_DAYS) *
                        24 *
                        60 *
                        60 *
                        1000,
            );

        this.logger.log({
            msg: `aerial-precipitation purge: deleting series with forecastDate < ${cutoff.toISOString()}`,
        });

        const deletedCount = await this.aerialPrecipRepo.deleteOlderThan(cutoff);

        this.logger.log({
            msg: 'aerial-precipitation purge complete',
            deletedCount,
        });

        if (deletedCount > 0) {
            await this.cacheService.delByPattern(AerialPrecipitationCacheKeys.pattern());
            this.logger.log({ msg: 'aerial-precipitation cache invalidated after purge' });
        }

        return new PurgeOldAerialPrecipitationResult({ deletedCount });
    }
}
