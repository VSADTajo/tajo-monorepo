export interface ManeuverSeriesPointShape {
    date: string;
    time: string;
    value: number;
    flag?: number;
}

export interface CreateManualSimulationDtoShape {
    description?: string;
    modmeteo: 'HARMONIE' | 'EPS' | 'BOTH';
    maneuverIds?: string[];
    maneuvers?: {
        reservoirCode: string;
        outputFlowValue: number;
        startDate?: string;
        endDate?: string;
        series?: ManeuverSeriesPointShape[];
    }[];
}

export function buildCreateManualSimulationDto(
    overrides?: Partial<CreateManualSimulationDtoShape>,
): CreateManualSimulationDtoShape {
    return {
        description: 'Test manual simulation',
        modmeteo: 'HARMONIE',
        maneuverIds: [],
        ...overrides,
    };
}

export interface CreateManeuverDtoShape {
    reservoirCode: string;
    outputFlowValue: number;
}

export function buildCreateManeuverDto(overrides?: Partial<CreateManeuverDtoShape>): CreateManeuverDtoShape {
    return {
        reservoirCode: 'E001',
        outputFlowValue: 12.5,
        ...overrides,
    };
}
