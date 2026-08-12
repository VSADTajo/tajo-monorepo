import { ScenarioFile } from '@domain/entities/scenario-file.entity';

export abstract class IScenarioFileRepository {
    /** Persist 1..N files belonging to a scenario. */
    abstract createMany(files: ScenarioFile[]): Promise<ScenarioFile[]>;

    /** Files of a scenario WITHOUT the heavy `content` bytea (listing/metadata). */
    abstract findMetadataByScenario(scenarioId: string): Promise<ScenarioFile[]>;

    /** A single file (with `content`) scoped to its scenario — for download/replace/delete. */
    abstract findByScenarioAndId(scenarioId: string, fileId: string): Promise<ScenarioFile>;

    /** Replace an existing file's content/metadata. */
    abstract update(file: ScenarioFile): Promise<ScenarioFile>;

    abstract delete(id: string): Promise<void>;
}
