import { MeteoIngestRun } from '../../../src/app/domain/entities/meteo-ingest-run.entity';
import { IngestStatus, TriggerSource } from '../../../src/app/domain/types/ingest-status.enum';

describe('MeteoIngestRun audit (entity invariants)', () => {
    function build(): MeteoIngestRun {
        return new MeteoIngestRun({
            provider: 'HARMONIE',
            variable: 'Precipitacion',
            triggeredBy: TriggerSource.MANUAL,
            startedAt: new Date('2026-04-06T18:00:00Z'),
            status: IngestStatus.RUNNING,
            filesProcessed: 0,
            filesOk: 0,
            filesFailed: 0,
        });
    }

    it('markRunning resets counters and clears finishedAt', () => {
        const run = build();
        run.markRunning();
        expect(run.status).toBe(IngestStatus.RUNNING);
        expect(run.finishedAt).toBeNull();
        expect(run.filesProcessed).toBe(0);
    });

    it('markOk produces a valid row with files_processed = files_ok', () => {
        const run = build();
        run.markRunning();
        run.markOk(48);
        run.validate();
        expect(run.status).toBe(IngestStatus.OK);
        expect(run.filesOk).toBe(48);
        expect(run.filesFailed).toBe(0);
        expect(run.filesProcessed).toBe(48);
        expect(run.finishedAt).not.toBeNull();
        expect(run.errorSummary).toBeNull();
    });

    it('markPartial captures both counters and an error summary', () => {
        const run = build();
        run.markRunning();
        run.markPartial(47, 1, 'file 23 failed: gdal exit 1');
        run.validate();
        expect(run.status).toBe(IngestStatus.PARTIAL);
        expect(run.filesOk).toBe(47);
        expect(run.filesFailed).toBe(1);
        expect(run.filesProcessed).toBe(48);
        expect(run.errorSummary).toContain('gdal');
    });

    it('markFailed without files keeps counters at zero', () => {
        const run = build();
        run.markRunning();
        run.markFailed('discovery failed: ENOENT');
        run.validate();
        expect(run.status).toBe(IngestStatus.FAILED);
        expect(run.filesProcessed).toBe(0);
        expect(run.errorSummary).toContain('ENOENT');
    });

    it('markNoop is the explicit "nothing to do" state', () => {
        const run = build();
        run.markRunning();
        run.markNoop();
        run.validate();
        expect(run.status).toBe(IngestStatus.NOOP);
        expect(run.filesProcessed).toBe(0);
    });

    it('validate() rejects mismatched counters', () => {
        const run = build();
        run.startedAt = new Date();
        run.status = IngestStatus.OK;
        run.triggeredBy = TriggerSource.MANUAL;
        run.filesOk = 10;
        run.filesFailed = 5;
        run.filesProcessed = 12; // wrong on purpose
        expect(() => run.validate()).toThrow(/files_processed/);
    });

    it('validate() rejects an unknown status', () => {
        const run = build();
        run.markRunning();
        (run as any).status = 'bogus';
        expect(() => run.validate()).toThrow(/invalid status/);
    });
});
