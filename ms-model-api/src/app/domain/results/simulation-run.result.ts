import { SimulationRunStatus } from '@domain/types/simulation-run-status.enum';

export interface ISimulationRunResult {
    id: string;
    simulationId: string;
    outputFolder: string;
    status: SimulationRunStatus;
    startedAt: Date;
    completedAt: Date | null;
    errorMessage: string | null;
}

export class SimulationRunResult {
    readonly id: string;
    readonly simulationId: string;
    readonly outputFolder: string;
    readonly status: SimulationRunStatus;
    readonly startedAt: Date;
    readonly completedAt: Date | null;
    readonly errorMessage: string | null;

    constructor(params: ISimulationRunResult) {
        this.id = params.id;
        this.simulationId = params.simulationId;
        this.outputFolder = params.outputFolder;
        this.status = params.status;
        this.startedAt = params.startedAt;
        this.completedAt = params.completedAt;
        this.errorMessage = params.errorMessage;
    }
}
