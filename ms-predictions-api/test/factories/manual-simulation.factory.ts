export interface CreateManualSimulationDtoShape {
    simulationDate: string;
    description?: string;
    maneuvers: Array<{ reservoirCode: string; outputFlowValue: number }>;
}

export function buildCreateManualSimulationDto(
    overrides?: Partial<CreateManualSimulationDtoShape>,
): CreateManualSimulationDtoShape {
    return {
        simulationDate: '20260619120000',
        description: 'Test manual simulation',
        maneuvers: [
            { reservoirCode: 'E001', outputFlowValue: 12.5 },
            { reservoirCode: 'E002', outputFlowValue: 0.0 },
        ],
        ...overrides,
    };
}
