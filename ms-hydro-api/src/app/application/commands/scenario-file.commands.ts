import { HttpStatus, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

// Domain
import { ScenarioFile } from '@domain/entities/scenario-file.entity';
import { IScenarioRepository } from '@domain/ports/scenario-repository.port';
import { IScenarioFileRepository } from '@domain/ports/scenario-file-repository.port';
import {
    AddFilesToScenarioResult,
    ScenarioFileMetadataResult,
    DeleteScenarioFileResult,
} from '@domain/results/scenario-file.results';
import { ApiError } from '@domain/errors/api.error';
import { RepositoryError } from '@domain/errors/repository.error';

export interface IScenarioFileInput {
    filename: string;
    contentType: string;
    content: Buffer;
}

function toMetadataResult(file: ScenarioFile): ScenarioFileMetadataResult {
    return new ScenarioFileMetadataResult({
        id: file.id,
        scenarioId: file.scenarioId,
        filename: file.filename,
        contentType: file.contentType,
        sizeBytes: file.sizeBytes,
        createdAt: file.createdAt!,
        updatedAt: file.updatedAt!,
    });
}

// ─────────────────────────────────────────────────────────────
// AddFilesToScenario (1..N files of any type)
// ─────────────────────────────────────────────────────────────

export interface IAddFilesToScenarioCommand {
    scenarioId: string;
    files: IScenarioFileInput[];
}

export class AddFilesToScenarioCommand {
    constructor(private readonly parameters: IAddFilesToScenarioCommand) {}
    get scenarioId(): string {
        return this.parameters.scenarioId;
    }
    get files(): IScenarioFileInput[] {
        return this.parameters.files;
    }
}

@CommandHandler(AddFilesToScenarioCommand)
export class AddFilesToScenarioHandler implements ICommandHandler<AddFilesToScenarioCommand, AddFilesToScenarioResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly scenarioRepository: IScenarioRepository,
        private readonly scenarioFileRepository: IScenarioFileRepository,
    ) {}

    async execute(command: AddFilesToScenarioCommand): Promise<AddFilesToScenarioResult> {
        this.logger.log({ msg: 'Adding files to scenario', entity: 'ScenarioFiles', scenarioId: command.scenarioId, count: command.files.length });

        if (command.files.length === 0) {
            throw new ApiError(HttpStatus.BAD_REQUEST, 'At least one file is required');
        }

        await this.assertScenarioExists(command.scenarioId);

        const entities = command.files.map((input) => {
            const file = new ScenarioFile({
                scenarioId: command.scenarioId,
                filename: input.filename,
                contentType: input.contentType,
                content: input.content,
            });
            file.validate();
            return file;
        });

        const persisted = await this.scenarioFileRepository.createMany(entities);

        this.logger.log({ msg: 'Files added to scenario', entity: 'ScenarioFiles', scenarioId: command.scenarioId, ids: persisted.map((f) => f.id) });

        return new AddFilesToScenarioResult({
            scenarioId: command.scenarioId,
            files: persisted.map(toMetadataResult),
        });
    }

    private async assertScenarioExists(scenarioId: string): Promise<void> {
        try {
            await this.scenarioRepository.findById(scenarioId);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `Scenario with id "${scenarioId}" not found`);
            }
            throw error;
        }
    }
}

// ─────────────────────────────────────────────────────────────
// ReplaceScenarioFile (patch a single file)
// ─────────────────────────────────────────────────────────────

export interface IReplaceScenarioFileCommand {
    scenarioId: string;
    fileId: string;
    filename: string;
    contentType: string;
    content: Buffer;
}

export class ReplaceScenarioFileCommand {
    constructor(private readonly parameters: IReplaceScenarioFileCommand) {}
    get scenarioId(): string {
        return this.parameters.scenarioId;
    }
    get fileId(): string {
        return this.parameters.fileId;
    }
    get filename(): string {
        return this.parameters.filename;
    }
    get contentType(): string {
        return this.parameters.contentType;
    }
    get content(): Buffer {
        return this.parameters.content;
    }
}

@CommandHandler(ReplaceScenarioFileCommand)
export class ReplaceScenarioFileHandler implements ICommandHandler<ReplaceScenarioFileCommand, ScenarioFileMetadataResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly scenarioFileRepository: IScenarioFileRepository,
    ) {}

    async execute(command: ReplaceScenarioFileCommand): Promise<ScenarioFileMetadataResult> {
        this.logger.log({ msg: 'Replacing scenario file', entity: 'ScenarioFiles', scenarioId: command.scenarioId, fileId: command.fileId });

        const file = await this.findFileOrThrow(command.scenarioId, command.fileId);

        file.filename = command.filename;
        file.contentType = command.contentType;
        file.content = command.content;
        file.validate();

        const updated = await this.scenarioFileRepository.update(file);

        this.logger.log({ msg: 'Scenario file replaced', entity: 'ScenarioFiles', fileId: updated.id });

        return toMetadataResult(updated);
    }

    private async findFileOrThrow(scenarioId: string, fileId: string): Promise<ScenarioFile> {
        try {
            return await this.scenarioFileRepository.findByScenarioAndId(scenarioId, fileId);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `File "${fileId}" not found in scenario "${scenarioId}"`);
            }
            throw error;
        }
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteScenarioFile
// ─────────────────────────────────────────────────────────────

export interface IDeleteScenarioFileCommand {
    scenarioId: string;
    fileId: string;
}

export class DeleteScenarioFileCommand {
    constructor(private readonly parameters: IDeleteScenarioFileCommand) {}
    get scenarioId(): string {
        return this.parameters.scenarioId;
    }
    get fileId(): string {
        return this.parameters.fileId;
    }
}

@CommandHandler(DeleteScenarioFileCommand)
export class DeleteScenarioFileHandler implements ICommandHandler<DeleteScenarioFileCommand, DeleteScenarioFileResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly scenarioFileRepository: IScenarioFileRepository,
    ) {}

    async execute(command: DeleteScenarioFileCommand): Promise<DeleteScenarioFileResult> {
        this.logger.log({ msg: 'Deleting scenario file', entity: 'ScenarioFiles', scenarioId: command.scenarioId, fileId: command.fileId });

        try {
            await this.scenarioFileRepository.findByScenarioAndId(command.scenarioId, command.fileId);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `File "${command.fileId}" not found in scenario "${command.scenarioId}"`);
            }
            throw error;
        }

        await this.scenarioFileRepository.delete(command.fileId);

        this.logger.log({ msg: 'Scenario file deleted', entity: 'ScenarioFiles', fileId: command.fileId });

        return new DeleteScenarioFileResult({ id: command.fileId, deleted: true });
    }
}
