export interface IProviderConfigResult {
    id: string;
    name: string;
    type: string;
    baseUrl: string;
    pollingIntervalMinutes: number;
    isActive: boolean;
    settings: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

export class ProviderConfigResult {
    readonly id: string;
    readonly name: string;
    readonly type: string;
    readonly baseUrl: string;
    readonly pollingIntervalMinutes: number;
    readonly isActive: boolean;
    readonly settings: Record<string, unknown>;
    readonly createdAt: Date;
    readonly updatedAt: Date;

    constructor(parameters: IProviderConfigResult) {
        this.id = parameters.id;
        this.name = parameters.name;
        this.type = parameters.type;
        this.baseUrl = parameters.baseUrl;
        this.pollingIntervalMinutes = parameters.pollingIntervalMinutes;
        this.isActive = parameters.isActive;
        this.settings = parameters.settings;
        this.createdAt = parameters.createdAt;
        this.updatedAt = parameters.updatedAt;
    }
}
