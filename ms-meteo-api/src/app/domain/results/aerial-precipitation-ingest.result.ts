/**
 * Summary returned after a `PollAerialPrecipitationCommand` completes.
 * Carries the counts and timing that are both logged and (in Phase 2) written
 * to the MeteoIngestRun audit table.
 */
export class AerialPrecipitationIngestRunResult {
    readonly filesProcessed: number;
    readonly filesFailed: number;
    readonly seriesPersisted: number;
    readonly eventsPersisted: number;
    readonly seriesSkipped: number;
    readonly durationMs: number;
    readonly runId: string;

    constructor(params: {
        filesProcessed: number;
        filesFailed: number;
        seriesPersisted: number;
        eventsPersisted: number;
        seriesSkipped: number;
        durationMs: number;
        runId: string;
    }) {
        this.filesProcessed = params.filesProcessed;
        this.filesFailed = params.filesFailed;
        this.seriesPersisted = params.seriesPersisted;
        this.eventsPersisted = params.eventsPersisted;
        this.seriesSkipped = params.seriesSkipped;
        this.durationMs = params.durationMs;
        this.runId = params.runId;
    }
}
