// ─────────────────────────────────────────────────────────────
// ScenarioFile metadata (no content) — used by listings and mutations
// ─────────────────────────────────────────────────────────────

export class ScenarioFileMetadataResult {
    readonly id: string;
    readonly scenarioId: string;
    readonly filename: string;
    readonly contentType: string;
    readonly sizeBytes: number;
    readonly createdAt: Date;
    readonly updatedAt: Date;

    constructor(params: {
        id: string;
        scenarioId: string;
        filename: string;
        contentType: string;
        sizeBytes: number;
        createdAt: Date;
        updatedAt: Date;
    }) {
        this.id = params.id;
        this.scenarioId = params.scenarioId;
        this.filename = params.filename;
        this.contentType = params.contentType;
        this.sizeBytes = params.sizeBytes;
        this.createdAt = params.createdAt;
        this.updatedAt = params.updatedAt;
    }
}

// ─────────────────────────────────────────────────────────────
// AddFilesToScenario
// ─────────────────────────────────────────────────────────────

export class AddFilesToScenarioResult {
    readonly scenarioId: string;
    readonly files: ScenarioFileMetadataResult[];

    constructor(params: { scenarioId: string; files: ScenarioFileMetadataResult[] }) {
        this.scenarioId = params.scenarioId;
        this.files = params.files;
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteScenarioFile
// ─────────────────────────────────────────────────────────────

export class DeleteScenarioFileResult {
    readonly id: string;
    readonly deleted: boolean;

    constructor(params: { id: string; deleted: boolean }) {
        this.id = params.id;
        this.deleted = params.deleted;
    }
}

// ─────────────────────────────────────────────────────────────
// DownloadScenarioFile (raw bytes + content type)
// ─────────────────────────────────────────────────────────────

export class DownloadScenarioFileResult {
    readonly filename: string;
    readonly contentType: string;
    readonly content: Buffer;

    constructor(params: { filename: string; contentType: string; content: Buffer }) {
        this.filename = params.filename;
        this.contentType = params.contentType;
        this.content = params.content;
    }
}
