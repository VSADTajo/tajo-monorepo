export interface IIngestionRunResult {
    id: string;
    providerConfigId: string;
    status: string;
    startedAt: Date;
    completedAt: Date | null;
    seriesCount: number;
    eventsCount: number;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export class IngestionRunResult {
    readonly id: string;
    readonly providerConfigId: string;
    readonly status: string;
    readonly startedAt: Date;
    readonly completedAt: Date | null;
    readonly seriesCount: number;
    readonly eventsCount: number;
    readonly errorMessage: string | null;
    readonly createdAt: Date;
    readonly updatedAt: Date;

    constructor(parameters: IIngestionRunResult) {
        this.id = parameters.id;
        this.providerConfigId = parameters.providerConfigId;
        this.status = parameters.status;
        this.startedAt = parameters.startedAt;
        this.completedAt = parameters.completedAt;
        this.seriesCount = parameters.seriesCount;
        this.eventsCount = parameters.eventsCount;
        this.errorMessage = parameters.errorMessage;
        this.createdAt = parameters.createdAt;
        this.updatedAt = parameters.updatedAt;
    }
}
