import Ajv from 'ajv';
import draft06 from 'ajv/dist/refs/json-schema-draft-06.json';

import { buildManualSimulationFile, StationMeta, FileManeuverInput } from './manual-simulation-file.builder';
import piRestTimeSeriesSchema from '../../../../test/fixtures/pi-rest-timeseries.schema.json';

/**
 * Validates the generated input against Delft-FEWS' own PI-JSON schema.
 *
 * Until now the format was derived from an example file Idrica sent, so the only
 * assurance that FEWS would accept it was that it looked like the example. The
 * schema is the authoritative contract, published by Deltares at
 * https://fewsdocs.deltares.nl/webservices/rest-api/v1/schemas/pirest/pi_rest_timeseries.json
 * and vendored under `test/fixtures/` so this test does not depend on the network.
 *
 * It matters because the schema declares `additionalProperties: false` at every
 * level: one stray key — a rename, a field added "just in case" — is a 400 from
 * the import, not a warning. That failure would surface as a simulation that
 * never produces data, which is exactly the class of bug that already cost us
 * time on the output side.
 */
describe('buildManualSimulationFile — PI-JSON schema conformance', () => {
    const ajv = new Ajv({ allErrors: true, strict: false });
    ajv.addMetaSchema(draft06);
    const validate = ajv.compile(piRestTimeSeriesSchema);

    const forecastDate = new Date('2026-07-22T00:00:00Z');
    const now = new Date('2026-07-22T05:10:00Z');

    const alcorlo: StationMeta = {
        code: 'E_09',
        name: 'ALCORLO',
        latitude: 41.008652934448925,
        longitude: -3.0240949838231646,
        altitude: 924,
    };

    /** A station the catalog knows nothing about, to cover the null-geo path. */
    const unknown: StationMeta = {
        code: 'E_21',
        name: '',
        latitude: null,
        longitude: null,
        altitude: null,
    };

    function build(maneuvers: FileManeuverInput[], stations: StationMeta[] = [alcorlo]) {
        const stationsByCode = stations.reduce<Record<string, StationMeta>>((acc, s) => {
            acc[s.code.toLowerCase()] = s;
            return acc;
        }, {});
        return buildManualSimulationFile({ maneuvers, stationsByCode, forecastDate, now });
    }

    function expectValid(content: unknown): void {
        const isValid = validate(content);
        if (!isValid) {
            const detail = (validate.errors ?? [])
                .map((error) => `${error.instancePath || '/'} ${error.message}`)
                .join('\n');
            throw new Error(`Generated input does not conform to the FEWS PI-JSON schema:\n${detail}`);
        }
        expect(isValid).toBe(true);
    }

    it('accepts a FLAT maneuver', () => {
        const { content } = build([{ reservoirCode: 'E_09', outputFlowValue: 20 }]);
        expectValid(content);
    });

    it('accepts a CURVE maneuver', () => {
        const { content } = build([
            {
                reservoirCode: 'E_09',
                outputFlowValue: 12.5,
                series: [
                    { date: '2026-07-22', time: '00:00:00', value: 12.5 },
                    { date: '2026-07-22', time: '00:15:00', value: 13, flag: 0 },
                ],
            },
        ]);
        expectValid(content);
    });

    it('accepts several stations at once, including one with no catalog geo data', () => {
        const { content } = build(
            [
                { reservoirCode: 'E_09', outputFlowValue: 20 },
                { reservoirCode: 'E_21', outputFlowValue: 8 },
            ],
            [alcorlo, unknown],
        );
        expectValid(content);
    });

    it('rejects an envelope carrying a key the schema does not declare', () => {
        // Guards the guard: proves additionalProperties is actually being enforced,
        // so a green suite above means something.
        const { content } = build([{ reservoirCode: 'E_09', outputFlowValue: 20 }]);
        expect(validate({ ...content, unexpectedField: 'x' })).toBe(false);
    });
});
