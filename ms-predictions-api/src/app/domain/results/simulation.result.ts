export interface ISimulationResult {
    id: string;
    simulationDate: string;
    jobType: string | null;
    modmeteo: string | null;
    status: string;
    type: string;
    environment: string | null;
    description: string | null;
    createdBy: string | null;
    createdAt: Date;
    updatedAt: Date;
    predictionCount?: number;
}

export class SimulationResult {
    readonly id: string;
    readonly simulationDate: string;
    readonly jobType: string | null;
    readonly modmeteo: string | null;
    readonly status: string;
    readonly type: string;
    readonly environment: string | null;
    readonly description: string | null;
    readonly createdBy: string | null;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly predictionCount?: number;

    constructor(parameters: ISimulationResult) {
        this.id = parameters.id;
        this.simulationDate = parameters.simulationDate;
        this.jobType = parameters.jobType;
        this.modmeteo = parameters.modmeteo;
        this.status = parameters.status;
        this.type = parameters.type;
        this.environment = parameters.environment;
        this.description = parameters.description;
        this.createdBy = parameters.createdBy;
        this.createdAt = parameters.createdAt;
        this.updatedAt = parameters.updatedAt;
        this.predictionCount = parameters.predictionCount;
    }
}
