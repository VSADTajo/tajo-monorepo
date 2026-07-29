import { Inject, Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import axios, { AxiosRequestConfig } from 'axios';

import { ProviderError } from '@domain/errors/provider.error';
import { FewsApiConfigService } from '@config/fews-api/fews-api-config.service';
import { FewsTarget } from '@domain/types/fews-target.type';

/**
 * Task run states reported by FEWS.
 *
 * Taken verbatim from the published OpenAPI description of `GET /taskrunstatus`
 * (Delft-FEWS Web Services REST API v1). Anything outside this list is treated
 * as unknown and never as success.
 */
export enum FewsTaskStatus {
    INVALID = 'I',
    PENDING = 'P',
    TERMINATED = 'T',
    RUNNING = 'R',
    FAILED = 'F',
    COMPLETED = 'C',
    PARTLY_SUCCESSFUL = 'D',
    APPROVED = 'A',
    APPROVED_PARTLY_SUCCESSFUL = 'B',
}

/** States where results exist and can be read back. */
const USABLE_STATES: FewsTaskStatus[] = [
    FewsTaskStatus.COMPLETED,
    FewsTaskStatus.PARTLY_SUCCESSFUL,
    FewsTaskStatus.APPROVED,
    FewsTaskStatus.APPROVED_PARTLY_SUCCESSFUL,
];

/** States where the run is over and produced nothing usable. */
const TERMINAL_FAILURES: FewsTaskStatus[] = [FewsTaskStatus.FAILED, FewsTaskStatus.TERMINATED, FewsTaskStatus.INVALID];

/** States where the run is still in flight. */
const IN_FLIGHT: FewsTaskStatus[] = [FewsTaskStatus.PENDING, FewsTaskStatus.RUNNING];

/**
 * Diagnostic levels of a PI Diag document. FEWS answers an import with one of
 * these documents per line; only the first two mean the import did not happen.
 */
const DIAG_LEVEL_ERROR = 1;

export interface RunTaskParams {
    startTime: Date;
    endTime: Date;
    description: string;
}

export interface TaskOutcome {
    status: FewsTaskStatus;
    description: string;
    taskRunId: string;
}

interface DiagLine {
    level: number;
    description: string;
}

/** FEWS wants second precision without milliseconds: 2026-07-27T09:00:00Z. */
function toFewsTime(date: Date): string {
    return `${date.toISOString().split('.')[0]}Z`;
}

/**
 * Pulls the lines out of a PI Diag document.
 *
 * Deliberately a regex rather than an XML parser: the document is a flat list of
 * self-closing `<line level="n" description="..."/>` elements, and adding an XML
 * dependency to read four attributes is not worth it. Real quotes inside a
 * description arrive escaped, so the attribute match cannot run past its value.
 */
function parseDiagLines(document: string): DiagLine[] {
    const lines: DiagLine[] = [];
    const pattern = /<line\s+level="(\d+)"\s+description="([^"]*)"/g;

    let match = pattern.exec(document);
    while (match !== null) {
        lines.push({ level: Number(match[1]), description: match[2] });
        match = pattern.exec(document);
    }

    return lines;
}

/** Reads the "N time series rejected" counter FEWS reports on every import. */
function countRejectedSeries(lines: DiagLine[]): number {
    for (const line of lines) {
        const match = /(\d+)\s+time series rejected/i.exec(line.description);
        if (match) {
            return Number(match[1]);
        }
    }

    return 0;
}

/**
 * Talks to the Delft-FEWS PI REST web service: push the input series, launch the
 * workflow, follow the task run, and read the results back.
 *
 * Every call takes its {@link FewsTarget} as an argument instead of reading the
 * configuration itself. That is what lets the MOCK source run this exact code
 * against a local fake: the mock is a different target, not a different code
 * path, so a green mock check is evidence about the real integration.
 */
@Injectable()
export class FewsTaskClientService {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly config: FewsApiConfigService,
    ) {}

    private endpoint(target: FewsTarget, resource: string): string {
        return `${target.baseUrl}${target.servicePath}/${resource}`;
    }

    /** Basic auth only when credentials were provided; otherwise the field is omitted. */
    private requestOptions(target: FewsTarget, params: Record<string, string | number>): AxiosRequestConfig {
        const options: AxiosRequestConfig = {
            params,
            timeout: this.config.requestTimeoutMs,
        };
        if (target.username) {
            options.auth = { username: target.username, password: target.password };
        }
        return options;
    }

    /**
     * Uploads the simulation input under the configured filter.
     *
     * The body is the PI-JSON document as `application/json`, which is what the
     * API declares for this endpoint. FEWS answers with a PI Diag document that
     * reports how many series it actually took — a 200 alone does not mean the
     * import happened, so the diagnostics are inspected rather than discarded.
     */
    async postTimeSeries(target: FewsTarget, content: string): Promise<void> {
        if (!target.filterId) {
            throw new ProviderError('FEWS_FILTER_ID is not configured — cannot post the simulation input');
        }

        const url = this.endpoint(target, 'timeseries');
        let diagnostics: string;
        try {
            const response = await axios.post(url, content, {
                ...this.requestOptions(target, { filterId: target.filterId }),
                headers: { 'Content-Type': 'application/json' },
                responseType: 'text',
                transformResponse: [(data) => data],
            });
            diagnostics = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error({
                msg: 'Failed to post time series to FEWS',
                entity: 'FewsTaskClient',
                url,
                error: message,
            });
            throw new ProviderError(`Failed to post time series to FEWS: ${message}`);
        }

        const lines = parseDiagLines(diagnostics);
        const errors = lines.filter((line) => line.level <= DIAG_LEVEL_ERROR);
        const rejected = countRejectedSeries(lines);

        if (errors.length > 0 || rejected > 0) {
            const detail =
                errors.length > 0 ? errors.map((line) => line.description).join(' | ') : `${rejected} series rejected`;
            this.logger.error({
                msg: 'FEWS accepted the request but rejected the import',
                entity: 'FewsTaskClient',
                url,
                filterId: target.filterId,
                rejected,
                diagnostics,
            });
            throw new ProviderError(`FEWS rejected the simulation input: ${detail}`);
        }

        this.logger.log({
            msg: 'Posted simulation input to FEWS',
            entity: 'FewsTaskClient',
            url,
            filterId: target.filterId,
            diagnosticLines: lines.length,
        });
    }

    /** Launches the configured workflow. Returns the task id FEWS replies with. */
    async runTask(target: FewsTarget, params: RunTaskParams): Promise<string> {
        if (!target.workflowId) {
            throw new ProviderError('FEWS_WORKFLOW_ID is not configured — cannot launch the model');
        }

        const url = this.endpoint(target, 'runtask');
        let taskId: string;
        try {
            const response = await axios.post(
                url,
                null,
                this.requestOptions(target, {
                    workflowId: target.workflowId,
                    startTime: toFewsTime(params.startTime),
                    endTime: toFewsTime(params.endTime),
                    description: params.description,
                    // One of 'all' | 'alloneatatime' | 'allmostrecentonly'.
                    runOption: 'all',
                }),
            );
            // The endpoint answers text/plain with the task id as the whole body.
            taskId = String(response.data ?? '').trim();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error({ msg: 'Failed to launch FEWS task', entity: 'FewsTaskClient', url, error: message });
            throw new ProviderError(`Failed to launch FEWS workflow "${target.workflowId}": ${message}`);
        }

        if (!taskId) {
            throw new ProviderError(`FEWS accepted the run request for "${target.workflowId}" but returned no task id`);
        }

        this.logger.log({ msg: 'FEWS task launched', entity: 'FewsTaskClient', workflowId: target.workflowId, taskId });
        return taskId;
    }

    /**
     * Reads a task run state once.
     *
     * `documentFormat=PI_JSON` is required: without it the endpoint answers
     * text/plain with the bare status letter, and the JSON envelope this method
     * reads would never be there. The envelope is flat — `code`, `description`,
     * `taskRunId` at the root, not nested under a `status` object.
     */
    async getTaskStatus(target: FewsTarget, taskId: string): Promise<TaskOutcome> {
        const url = this.endpoint(target, 'taskrunstatus');
        try {
            const response = await axios.get(
                url,
                this.requestOptions(target, { taskId, maxWaitMillis: 1000, documentFormat: 'PI_JSON' }),
            );
            const body = (response.data ?? {}) as { code?: string; description?: string; taskRunId?: string };
            return {
                status: String(body.code ?? '') as FewsTaskStatus,
                description: String(body.description ?? ''),
                taskRunId: String(body.taskRunId ?? ''),
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new ProviderError(`Failed to read FEWS task status for "${taskId}": ${message}`);
        }
    }

    /**
     * Polls until the run reaches a state that produced results.
     * Throws on failure, on an unknown state, and on timeout — never returns a
     * task whose results cannot be trusted.
     */
    async waitForTask(target: FewsTarget, taskId: string): Promise<TaskOutcome> {
        const deadline = Date.now() + this.config.taskTimeoutMs;
        let last: TaskOutcome | null = null;

        while (Date.now() < deadline) {
            const outcome = await this.getTaskStatus(target, taskId);
            last = outcome;

            if (USABLE_STATES.includes(outcome.status)) {
                this.logger.log({
                    msg: 'FEWS task finished with usable results',
                    entity: 'FewsTaskClient',
                    taskId,
                    status: outcome.status,
                    taskRunId: outcome.taskRunId,
                });
                return outcome;
            }

            if (TERMINAL_FAILURES.includes(outcome.status)) {
                throw new ProviderError(
                    `FEWS task "${taskId}" ended as ${outcome.status} (${outcome.description || 'no detail'})`,
                );
            }

            if (!IN_FLIGHT.includes(outcome.status)) {
                throw new ProviderError(
                    `FEWS task "${taskId}" reported an unrecognised status "${outcome.status}" — refusing to assume success`,
                );
            }

            await new Promise((resolve) => setTimeout(resolve, this.config.taskPollIntervalMs));
        }

        throw new ProviderError(
            `FEWS task "${taskId}" did not finish within ${this.config.taskTimeoutMs} ms ` +
                `(last status: ${last?.status ?? 'unknown'})`,
        );
    }

    /** Reads the results of a finished task run as PI-JSON. */
    async getTimeSeries(target: FewsTarget, taskRunId: string): Promise<unknown> {
        const url = this.endpoint(target, 'timeseries');
        try {
            const response = await axios.get(
                url,
                this.requestOptions(target, {
                    documentFormat: 'PI_JSON',
                    filterId: target.filterId,
                    taskRunIds: taskRunId,
                }),
            );
            return response.data;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new ProviderError(`Failed to read FEWS results for task run "${taskRunId}": ${message}`);
        }
    }

    /** Classification helpers, exposed so callers do not re-implement the state table. */
    static isUsable(status: FewsTaskStatus): boolean {
        return USABLE_STATES.includes(status);
    }

    static isInFlight(status: FewsTaskStatus): boolean {
        return IN_FLIGHT.includes(status);
    }

    static isTerminalFailure(status: FewsTaskStatus): boolean {
        return TERMINAL_FAILURES.includes(status);
    }
}
