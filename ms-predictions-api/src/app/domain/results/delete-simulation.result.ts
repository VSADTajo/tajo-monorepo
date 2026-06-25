export class DeleteSimulationResult {
    readonly id: string;
    readonly deletedManeuvers: number;

    constructor(params: { id: string; deletedManeuvers: number }) {
        this.id = params.id;
        this.deletedManeuvers = params.deletedManeuvers;
    }
}
