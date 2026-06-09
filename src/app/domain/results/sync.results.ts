export class SyncGeoserverResult {
    readonly basinsCreated: number;
    readonly basinsUpdated: number;
    readonly subBasinsCreated: number;
    readonly subBasinsUpdated: number;
    readonly stationsCreated: number;
    readonly stationsUpdated: number;
    readonly thresholdsCreated: number;
    readonly thresholdsUpdated: number;
    readonly errors: string[];

    constructor(params: {
        basinsCreated: number;
        basinsUpdated: number;
        subBasinsCreated: number;
        subBasinsUpdated: number;
        stationsCreated: number;
        stationsUpdated: number;
        thresholdsCreated: number;
        thresholdsUpdated: number;
        errors: string[];
    }) {
        this.basinsCreated = params.basinsCreated;
        this.basinsUpdated = params.basinsUpdated;
        this.subBasinsCreated = params.subBasinsCreated;
        this.subBasinsUpdated = params.subBasinsUpdated;
        this.stationsCreated = params.stationsCreated;
        this.stationsUpdated = params.stationsUpdated;
        this.thresholdsCreated = params.thresholdsCreated;
        this.thresholdsUpdated = params.thresholdsUpdated;
        this.errors = params.errors;
    }
}
