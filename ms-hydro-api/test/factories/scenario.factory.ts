let counter = 0;

/**
 * Builds a CreateScenario payload in the sample-stations.json shape
 * ({ items: [...] }) with unique data per call.
 */
export function buildCreateScenarioDto(
    overrides: Partial<{ name: string; description: string | null; payload: Record<string, unknown> }> = {},
): { name: string; description?: string | null; payload: Record<string, unknown> } {
    counter += 1;
    return {
        name: `sample-stations-${counter}`,
        description: 'Escenario de prueba',
        payload: {
            items: [
                {
                    id: `local-AR${counter}`,
                    name: 'Río Ejemplo en Aranjuez',
                    stationCode: `AR${counter}`,
                    stationType: 'Aforo',
                    latitude: 40.0316,
                    longitude: -3.6042,
                    threshold: { umbralCaudal1: 15, umbralCaudal2: 25, umbralCaudal3: 40 },
                    predictions: {
                        historical: {
                            id: `local-AR${counter}-FICT98.historical`,
                            results: [{ id: 1, date: '2026-07-27T17:19:47.457Z', value: 5.593, flag: 0 }],
                        },
                    },
                },
            ],
        },
        ...overrides,
    };
}
