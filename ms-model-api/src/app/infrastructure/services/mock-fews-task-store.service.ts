import { Inject, Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import axios from 'axios';

import { ProviderError } from '@domain/errors/provider.error';
import { FewsApiConfigService } from '@config/fews-api/fews-api-config.service';
import { SftpApiConfigService } from '@config/sftp-api/sftp-api-config.service';
import { AppConfigService } from '@config/app/app-config.service';
import { ENVIRONMENT } from '@config/app/app-config.type';
import { FewsTaskStatus } from '@infrastructure/services/fews-task-client.service';

const INTERNAL_CALLER_HEADER = { 'x-internal-caller': 'ms-model-api' };

/** Form field the real import reads the PI-JSON document from. */
const IMPORT_FORM_FIELD = 'piTimeSeriesJsonContent';

/** Top-level keys a PI-JSON time series document is allowed to carry. */
const ALLOWED_ENVELOPE_KEYS = ['version', 'timeZone', 'timeSeries', 'taskRunIds'];

interface MockTask {
    taskId: string;
    taskRunId: string;
    workflowId: string;
    launchedAt: number;
}

/**
 * State and behaviour of the fake PI REST service.
 *
 * Kept out of the controller so the state machine can be unit tested without
 * standing up HTTP, and so the controller stays a thin adapter like every other
 * one in the service.
 *
 * The fake is deliberately strict. A mock that accepts anything tells you your
 * client works when it does not; the point of this one is to fail on the same
 * things the real service fails on — an unparseable body, a document with keys
 * PI-JSON does not declare, an empty series list, a workflow it does not know.
 */
@Injectable()
export class MockFewsTaskStoreService {
    private readonly tasks = new Map<string, MockTask>();
    private sequence = 0;

    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly fewsApiConfigService: FewsApiConfigService,
        private readonly sftpApiConfigService: SftpApiConfigService,
        private readonly appConfigService: AppConfigService,
    ) {}

    /**
     * Stands in for the import. Returns the PI Diag document FEWS would answer,
     * including the "N time series rejected" counter the client checks.
     */
    importTimeSeries(body: unknown): string {
        this.assertEnabled();
        const document = this.parseDocument(body);
        const series = Array.isArray(document.timeSeries) ? document.timeSeries : [];

        const unknownKeys = Object.keys(document).filter((key) => !ALLOWED_ENVELOPE_KEYS.includes(key));
        if (unknownKeys.length > 0) {
            return this.diag([
                { level: 1, description: `Import.error: unknown properties in document: ${unknownKeys.join(', ')}` },
                { level: 3, description: `Import.info: 0 time series imported, ${series.length} time series rejected` },
            ]);
        }

        if (series.length === 0) {
            return this.diag([
                { level: 1, description: 'Import.error: document carries no time series' },
                { level: 3, description: 'Import.info: 0 time series imported, 0 time series rejected' },
            ]);
        }

        this.logger.log({
            msg: 'Mock FEWS accepted an import',
            entity: 'MockFewsTaskStore',
            seriesCount: series.length,
        });

        return this.diag([
            { level: 3, description: `Import.info: ${series.length} time series imported, 0 time series rejected` },
        ]);
    }

    /** Stands in for runtask. Returns the task id as the real endpoint does. */
    runTask(workflowId: string): string {
        this.assertEnabled();
        if (!workflowId) {
            throw new ProviderError('Mock FEWS: workflowId is required');
        }

        this.sequence += 1;
        const taskId = `mock-task-${this.sequence}`;
        const task: MockTask = {
            taskId,
            taskRunId: `mock-taskrun-${this.sequence}`,
            workflowId,
            launchedAt: Date.now(),
        };
        this.tasks.set(taskId, task);

        this.logger.log({
            msg: 'Mock FEWS launched a task',
            entity: 'MockFewsTaskStore',
            taskId,
            workflowId,
        });

        return taskId;
    }

    /**
     * Stands in for taskrunstatus, in the flat PI-JSON shape the real endpoint
     * uses: `code`, `description` and `taskRunId` at the root.
     *
     * The run reports pending, then running, then completed. With the default
     * window of zero it is completed on the first read, which keeps the mock
     * check quick; a window longer than the poller's interval is what makes the
     * poller genuinely walk through its in-flight branch.
     */
    taskRunStatus(taskId: string): {
        version: string;
        code: FewsTaskStatus;
        description: string;
        taskRunId: string | null;
    } {
        this.assertEnabled();
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new ProviderError(`Mock FEWS: unknown taskId "${taskId}"`);
        }

        const elapsed = Date.now() - task.launchedAt;
        const window = this.fewsApiConfigService.mockRunningMs;

        if (elapsed < window / 2) {
            return { version: '1.2', code: FewsTaskStatus.PENDING, description: 'Task pending', taskRunId: null };
        }

        if (elapsed < window) {
            return { version: '1.2', code: FewsTaskStatus.RUNNING, description: 'Task running', taskRunId: null };
        }

        return {
            version: '1.2',
            code: FewsTaskStatus.COMPLETED,
            description: 'Task completed fully successful',
            taskRunId: task.taskRunId,
        };
    }

    /**
     * Stands in for reading the results back: serves the reference PI-JSON output.
     *
     * It is the same file the previous mock copied into the output folder, so the
     * payload the pipeline receives is unchanged — a real FEWS output, not an
     * invention. Only the way it arrives is different, and that is the part being
     * put under test.
     */
    async timeSeries(taskRunId: string): Promise<unknown> {
        this.assertEnabled();
        const known = [...this.tasks.values()].some((task) => task.taskRunId === taskRunId);
        if (!known) {
            throw new ProviderError(`Mock FEWS: unknown taskRunId "${taskRunId}"`);
        }

        const sourcePath = this.appConfigService.mockModelOutputSftpPath;
        if (!sourcePath) {
            throw new ProviderError(
                'MOCK mode requested but MOCK_MODEL_OUTPUT_SFTP_PATH is not configured — there is no reference output to serve',
            );
        }

        const baseUrl = this.sftpApiConfigService.baseUrl;
        try {
            const response = await axios.get(`${baseUrl}/files/download`, {
                params: { path: sourcePath },
                responseType: 'arraybuffer',
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                headers: INTERNAL_CALLER_HEADER,
            });
            const raw = Buffer.from(response.data as ArrayBuffer).toString('utf-8');
            return JSON.parse(raw);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error({
                msg: 'Mock FEWS could not serve the reference output',
                entity: 'MockFewsTaskStore',
                sourcePath,
                error: message,
            });
            throw new ProviderError(`Mock FEWS could not read the reference output "${sourcePath}": ${message}`);
        }
    }

    /**
     * The fake is a development and validation aid, so it refuses to answer in
     * production. It stays available without any configuration everywhere else —
     * a mock you have to switch on is a mock nobody uses.
     */
    private assertEnabled(): void {
        if (this.appConfigService.nodeEnv === ENVIRONMENT.PRODUCTION) {
            throw new ProviderError('The mock FEWS service is not available in production');
        }
    }

    /**
     * Accepts the document the way the real import receives it — as the
     * `piTimeSeriesJsonContent` field of a form-encoded body — and, for the unit
     * tests, a parsed object or the raw JSON string as well.
     */
    private parseDocument(body: unknown): Record<string, unknown> {
        if (body !== null && typeof body === 'object' && !Array.isArray(body) && IMPORT_FORM_FIELD in body) {
            const field = (body as Record<string, unknown>)[IMPORT_FORM_FIELD];
            if (typeof field !== 'string') {
                throw new ProviderError(`Mock FEWS: ${IMPORT_FORM_FIELD} must be a string`);
            }
            return this.parseDocument(field);
        }

        if (typeof body === 'string') {
            try {
                return JSON.parse(body) as Record<string, unknown>;
            } catch {
                throw new ProviderError('Mock FEWS: request body is not valid JSON');
            }
        }

        if (body === null || typeof body !== 'object' || Array.isArray(body)) {
            throw new ProviderError('Mock FEWS: request body is not a PI-JSON document');
        }

        return body as Record<string, unknown>;
    }

    /** Builds a PI Diag document in the shape the real import answers with. */
    private diag(lines: { level: number; description: string }[]): string {
        const body = lines
            .map((line) => `    <line level="${line.level}" description="${line.description}"/>`)
            .join('\n');

        return [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<Diag xmlns="http://www.wldelft.nl/fews/PI" version="1.2">',
            body,
            '</Diag>',
        ].join('\n');
    }
}
