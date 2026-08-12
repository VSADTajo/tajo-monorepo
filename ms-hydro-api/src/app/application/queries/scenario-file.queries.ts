import { HttpStatus, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

// Domain
import { IScenarioFileRepository } from '@domain/ports/scenario-file-repository.port';
import { DownloadScenarioFileResult } from '@domain/results/scenario-file.results';
import { ApiError } from '@domain/errors/api.error';
import { RepositoryError } from '@domain/errors/repository.error';

// ─────────────────────────────────────────────────────────────
// DownloadScenarioFile (raw bytes for a single file)
// ─────────────────────────────────────────────────────────────

export interface IDownloadScenarioFileQuery {
    scenarioId: string;
    fileId: string;
}

export class DownloadScenarioFileQuery {
    constructor(private readonly parameters: IDownloadScenarioFileQuery) {}
    get scenarioId(): string {
        return this.parameters.scenarioId;
    }
    get fileId(): string {
        return this.parameters.fileId;
    }
}

@QueryHandler(DownloadScenarioFileQuery)
export class DownloadScenarioFileHandler implements IQueryHandler<DownloadScenarioFileQuery, DownloadScenarioFileResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly scenarioFileRepository: IScenarioFileRepository,
    ) {}

    async execute(query: DownloadScenarioFileQuery): Promise<DownloadScenarioFileResult> {
        this.logger.debug(`Downloading scenario file: scenario=${query.scenarioId} file=${query.fileId}`);

        let file;
        try {
            file = await this.scenarioFileRepository.findByScenarioAndId(query.scenarioId, query.fileId);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `File "${query.fileId}" not found in scenario "${query.scenarioId}"`);
            }
            throw error;
        }

        return new DownloadScenarioFileResult({
            filename: file.filename,
            contentType: file.contentType,
            content: file.content,
        });
    }
}
