import { Inject, Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import axios, { AxiosRequestConfig } from 'axios';

import { ProviderError } from '@domain/errors/provider.error';
import { FewsApiConfigService } from '@config/fews-api/fews-api-config.service';

/**
 * Task run states reported by FEWS.
 *
 * Taken from the PI REST service (see the fews-py-wrapper docs): the public
 * reference is a SPA we could not read, so anything not listed here is treated
 * as unknown and never as success — guessing a state would be the same mistake
 * that made us read a valid result file as corrupted.
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

/** FEWS wants second precision without milliseconds: 2026-07-27T09:00:00Z. */
function toFewsTime(date: Date): string {
    return `${date.toISOString().split('.')[0]}Z`;
}

/**
 * Talks to the Delft-FEWS PI REST web service: push the input series, launch the
 * workflow, follow the task run, and read the results back.
 *
 * Endpoint paths come from configuration rather than being hard-coded, because
 * the authoritative reference could not be read programmatically; the defaults
 * match what the official Python wrapper and our existing provider use, and a
 * mismatch is fixed with an env var instead of a release.
 */
@Injectable()
export class FewsTaskClientService {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly config: FewsApiConfigService,
    ) {}

    private endpoint(resource: string): string {
        return `${this.config.baseUrl}${this.config.servicePath}/${resource}`;
    }

    /** Basic auth only when credentials were provided; otherwise the field is omitted. */
    private requestOptions(params: Record<string, string | number>): AxiosRequestConfig {
        const options: AxiosRequestConfig = {
            params,
            timeout: this.config.requestTimeoutMs,
        };
        if (this.config.username) {
            options.auth = { username: this.config.username, password: this.config.password };
        }
        return options;
    }

    /** Uploads the simulation input under the configured filter. */
    async postTimeSeries(content: string): Promise<void> {
        const filterId = this.config.filterId;
        if (!filterId) {
            throw new ProviderError('FEWS_FILTER_ID is not configured — cannot post the simulation input');
        }

        const url = this.endpoint('timeseries');
        try {
            await axios.post(url, content, {
                ...this.requestOptions({ filterId }),
                headers: { 'Content-Type': 'application/xml' },
            });
            this.logger.log({ msg: 'Posted simulation input to FEWS', entity: 'FewsTaskClient', url, filterId });
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
    }

    /** Launches the configured workflow. Returns the task id FEWS replies with. */
    async runTask(params: RunTaskParams): Promise<string> {
        const workflowId = this.config.workflowId;
        if (!workflowId) {
            throw new ProviderError('FEWS_WORKFLOW_ID is not configured — cannot launch the model');
        }

        const url = this.endpoint('runtask');
        let taskId: string;
        try {
            const response = await axios.post(
                url,
                null,
                this.requestOptions({
                    workflowId,
                    startTime: toFewsTime(params.startTime),
                    endTime: toFewsTime(params.endTime),
                    description: params.description,
                    // "all" mirrors the wrapper's default run option.
                    runOption: 'all',
                }),
            );
            taskId = String(response.data ?? '').trim();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error({ msg: 'Failed to launch FEWS task', entity: 'FewsTaskClient', url, error: message });
            throw new ProviderError(`Failed to launch FEWS workflow "${workflowId}": ${message}`);
        }

        if (!taskId) {
            throw new ProviderError(`FEWS accepted the run request for "${workflowId}" but returned no task id`);
        }

        this.logger.log({ msg: 'FEWS task launched', entity: 'FewsTaskClient', workflowId, taskId });
        return taskId;
    }

    /** Reads a task run state once. */
    async getTaskStatus(taskId: string): Promise<TaskOutcome> {
        const url = this.endpoint('taskrunstatus');
        try {
            const response = await axios.get(url, this.requestOptions({ taskId, maxWaitMillis: 1000 }));
            const status = response.data?.status ?? {};
            return {
                status: String(status.code ?? '') as FewsTaskStatus,
                description: String(status.description ?? ''),
                taskRunId: String(status.taskRunId ?? ''),
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
    async waitForTask(taskId: string): Promise<TaskOutcome> {
        const deadline = Date.now() + this.config.taskTimeoutMs;
        let last: TaskOutcome | null = null;

        while (Date.now() < deadline) {
            const outcome = await this.getTaskStatus(taskId);
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
    async getTimeSeries(taskRunId: string): Promise<unknown> {
        const url = this.endpoint('timeseries');
        try {
            const response = await axios.get(
                url,
                this.requestOptions({
                    documentFormat: 'PI_JSON',
                    filterId: this.config.filterId,
                    taskRunIds: taskRunId,
                }),
            );
            return response.data;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new ProviderError(`Failed to read FEWS results for task run "${taskRunId}": ${message}`);
        }
    }
}
