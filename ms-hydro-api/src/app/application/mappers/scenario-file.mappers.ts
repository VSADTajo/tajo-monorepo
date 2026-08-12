import {
    AddFilesToScenarioCommand,
    ReplaceScenarioFileCommand,
    DeleteScenarioFileCommand,
} from '@application/commands/scenario-file.commands';
import { DownloadScenarioFileQuery } from '@application/queries/scenario-file.queries';
import {
    AddFilesToScenarioResult,
    ScenarioFileMetadataResult,
    DeleteScenarioFileResult,
} from '@domain/results/scenario-file.results';
import {
    AddFilesToScenarioResponseDto,
    ScenarioFileMetadataResponseDto,
    DeleteScenarioFileResponseDto,
} from '@api/dtos/scenario-file.dtos';

/** Shared: ScenarioFile metadata result → response DTO. */
export function scenarioFileMetadataToDto(result: ScenarioFileMetadataResult): ScenarioFileMetadataResponseDto {
    return {
        id: result.id,
        scenarioId: result.scenarioId,
        filename: result.filename,
        contentType: result.contentType,
        sizeBytes: result.sizeBytes,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
    };
}

// ─────────────────────────────────────────────────────────────
// AddFilesToScenario
// ─────────────────────────────────────────────────────────────

export class AddFilesToScenarioMapper {
    static toCommand(scenarioId: string, files: Express.Multer.File[]): AddFilesToScenarioCommand {
        return new AddFilesToScenarioCommand({
            scenarioId,
            files: files.map((file) => ({
                filename: file.originalname,
                contentType: file.mimetype,
                content: file.buffer,
            })),
        });
    }

    static toResponseDto(result: AddFilesToScenarioResult): AddFilesToScenarioResponseDto {
        return {
            scenarioId: result.scenarioId,
            files: result.files.map(scenarioFileMetadataToDto),
        };
    }
}

// ─────────────────────────────────────────────────────────────
// ReplaceScenarioFile
// ─────────────────────────────────────────────────────────────

export class ReplaceScenarioFileMapper {
    static toCommand(scenarioId: string, fileId: string, file: Express.Multer.File): ReplaceScenarioFileCommand {
        return new ReplaceScenarioFileCommand({
            scenarioId,
            fileId,
            filename: file.originalname,
            contentType: file.mimetype,
            content: file.buffer,
        });
    }

    static toResponseDto(result: ScenarioFileMetadataResult): ScenarioFileMetadataResponseDto {
        return scenarioFileMetadataToDto(result);
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteScenarioFile
// ─────────────────────────────────────────────────────────────

export class DeleteScenarioFileMapper {
    static toCommand(scenarioId: string, fileId: string): DeleteScenarioFileCommand {
        return new DeleteScenarioFileCommand({ scenarioId, fileId });
    }

    static toResponseDto(result: DeleteScenarioFileResult): DeleteScenarioFileResponseDto {
        return { id: result.id, deleted: result.deleted };
    }
}

// ─────────────────────────────────────────────────────────────
// DownloadScenarioFile
// ─────────────────────────────────────────────────────────────

export class DownloadScenarioFileMapper {
    static toQuery(scenarioId: string, fileId: string): DownloadScenarioFileQuery {
        return new DownloadScenarioFileQuery({ scenarioId, fileId });
    }
}
