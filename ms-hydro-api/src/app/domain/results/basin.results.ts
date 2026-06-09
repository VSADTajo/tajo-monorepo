// ─────────────────────────────────────────────────────────────
// CreateBasin
// ─────────────────────────────────────────────────────────────

export class CreateBasinResult {
    readonly id: string;
    readonly name: string;
    readonly code: string;
    readonly description: string | null;
    readonly isActive: boolean;
    readonly createdAt: Date;
    readonly updatedAt: Date;

    constructor(params: {
        id: string;
        name: string;
        code: string;
        description: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }) {
        this.id = params.id;
        this.name = params.name;
        this.code = params.code;
        this.description = params.description;
        this.isActive = params.isActive;
        this.createdAt = params.createdAt;
        this.updatedAt = params.updatedAt;
    }
}

// ─────────────────────────────────────────────────────────────
// GetBasin (with sub-basins)
// ─────────────────────────────────────────────────────────────

export class GetBasinSubBasinItem {
    readonly id: string;
    readonly name: string;
    readonly code: string;
    readonly isActive: boolean;

    constructor(params: { id: string; name: string; code: string; isActive: boolean }) {
        this.id = params.id;
        this.name = params.name;
        this.code = params.code;
        this.isActive = params.isActive;
    }
}

export class GetBasinResult {
    readonly id: string;
    readonly name: string;
    readonly code: string;
    readonly description: string | null;
    readonly isActive: boolean;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly subBasins: GetBasinSubBasinItem[];

    constructor(params: {
        id: string;
        name: string;
        code: string;
        description: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        subBasins: GetBasinSubBasinItem[];
    }) {
        this.id = params.id;
        this.name = params.name;
        this.code = params.code;
        this.description = params.description;
        this.isActive = params.isActive;
        this.createdAt = params.createdAt;
        this.updatedAt = params.updatedAt;
        this.subBasins = params.subBasins;
    }
}

// ─────────────────────────────────────────────────────────────
// ListBasins
// ─────────────────────────────────────────────────────────────

export class ListBasinsResult {
    readonly items: CreateBasinResult[];
    readonly total: number;

    constructor(params: { items: CreateBasinResult[]; total: number }) {
        this.items = params.items;
        this.total = params.total;
    }
}

// ─────────────────────────────────────────────────────────────
// UpdateBasin (same shape as CreateBasinResult)
// ─────────────────────────────────────────────────────────────

export class UpdateBasinResult extends CreateBasinResult {}

// ─────────────────────────────────────────────────────────────
// ToggleBasin
// ─────────────────────────────────────────────────────────────

export class ToggleBasinResult {
    readonly id: string;
    readonly name: string;
    readonly code: string;
    readonly isActive: boolean;
    readonly updatedAt: Date;

    constructor(params: { id: string; name: string; code: string; isActive: boolean; updatedAt: Date }) {
        this.id = params.id;
        this.name = params.name;
        this.code = params.code;
        this.isActive = params.isActive;
        this.updatedAt = params.updatedAt;
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteBasin (same as ToggleBasin — returns deactivated basin)
// ─────────────────────────────────────────────────────────────

export class DeleteBasinResult extends ToggleBasinResult {}
