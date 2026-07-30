// ─────────────────────────────────────────────────────────────
// Scenario metadata (no payload) — used by Create + List
// ─────────────────────────────────────────────────────────────

export class ScenarioMetadataResult {
    readonly id: string;
    readonly name: string;
    readonly description: string | null;
    readonly itemsCount: number;
    readonly sizeBytes: number;
    readonly createdAt: Date;
    readonly updatedAt: Date;

    constructor(params: {
        id: string;
        name: string;
        description: string | null;
        itemsCount: number;
        sizeBytes: number;
        createdAt: Date;
        updatedAt: Date;
    }) {
        this.id = params.id;
        this.name = params.name;
        this.description = params.description;
        this.itemsCount = params.itemsCount;
        this.sizeBytes = params.sizeBytes;
        this.createdAt = params.createdAt;
        this.updatedAt = params.updatedAt;
    }
}

// ─────────────────────────────────────────────────────────────
// GetScenario (metadata + full payload)
// ─────────────────────────────────────────────────────────────

export class GetScenarioResult extends ScenarioMetadataResult {
    readonly payload: Record<string, unknown>;

    constructor(params: {
        id: string;
        name: string;
        description: string | null;
        itemsCount: number;
        sizeBytes: number;
        payload: Record<string, unknown>;
        createdAt: Date;
        updatedAt: Date;
    }) {
        super(params);
        this.payload = params.payload;
    }
}

// ─────────────────────────────────────────────────────────────
// ListScenarios
// ─────────────────────────────────────────────────────────────

export class ListScenariosResult {
    readonly items: ScenarioMetadataResult[];
    readonly total: number;

    constructor(params: { items: ScenarioMetadataResult[]; total: number }) {
        this.items = params.items;
        this.total = params.total;
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteScenario
// ─────────────────────────────────────────────────────────────

export class DeleteScenarioResult {
    readonly id: string;
    readonly deleted: boolean;

    constructor(params: { id: string; deleted: boolean }) {
        this.id = params.id;
        this.deleted = params.deleted;
    }
}
