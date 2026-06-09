import { AemetGeoJsonFeature } from '../../src/app/domain/ports/aemet-client.port';

let counter = 0;

export function buildAvisosFeature(overrides?: Partial<AemetGeoJsonFeature['properties']>): AemetGeoJsonFeature {
    counter++;
    return {
        type: 'Feature',
        geometry: {
            type: 'Polygon',
            coordinates: [
                [
                    [-3.7, 40.4],
                    [-3.6, 40.5],
                    [-3.7, 40.4],
                ],
            ],
        },
        properties: {
            identifier: `alert-${counter}`,
            sender: 'http://www.aemet.es',
            sent: '2026-06-08T06:00:00+02:00',
            status: 'Actual',
            msgType: 'Alert',
            language: 'es-ES',
            category: 'Met',
            event: 'Aviso de temperaturas máximas de nivel amarillo',
            responseType: 'Monitor',
            urgency: 'Future',
            severity: 'Moderate',
            certainty: 'Likely',
            effective: '2026-06-08T06:00:00+02:00',
            onset: '2026-06-08T12:00:00+02:00',
            expires: '2026-06-09T06:00:00+02:00',
            senderName: 'AEMET',
            headline: 'Aviso de temperaturas máximas',
            description: 'Temperatura máxima: 38 ºC.',
            instruction: 'Esté atento.',
            web: 'https://www.aemet.es',
            contact: 'AEMET',
            eventCode: null,
            parameters: null,
            areaDesc: 'Madrid Metropolitana',
            polygon: '40.4,-3.7 40.5,-3.6 40.4,-3.7',
            geocode: '670128',
            eventTypeCode: 'AT',
            eventTypeName: 'Temperaturas máximas',
            provinciaCode: '28',
            level: 'amarillo',
            ...overrides,
        },
    };
}
