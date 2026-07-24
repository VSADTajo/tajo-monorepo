import { EntityError } from '@domain/errors/entity.error';

/**
 * Maps the locationId prefix (first two dot-segments) to the persisted layer value.
 *
 * Known prefixes from production FEWS files:
 *   - `Sistema`        → layer `sistema` (Sistemas de Explotación, e.g. `Sistema.Tajo.3`)
 *   - `Cuenca.NAM`     → layer `subcNAM` (Subcuencas NAM, e.g. `Cuenca.NAM.E_08`)
 *   - `Cuenca.AEMET`   → layer `aemet`   (AEMET MeteoAlerta zones, e.g. `Cuenca.AEMET.1`)
 */
const PREFIX_TO_LAYER: Array<{ prefix: string; layer: string }> = [
    { prefix: 'Sistema.', layer: 'sistema' },
    { prefix: 'Cuenca.NAM.', layer: 'subcNAM' },
    { prefix: 'Cuenca.AEMET.', layer: 'aemet' },
];

/**
 * Validates a FEWS locationId and derives the associated geographic layer.
 *
 * Throws `EntityError` on any unknown or empty locationId so that the ingester
 * can catch and skip the offending series while continuing with the rest of the file.
 */
export class LocationIdValueObject {
    public readonly value: string;
    public readonly layer: string;

    constructor(raw: string) {
        if (!raw) {
            throw new EntityError('locationId is required', 'locationId');
        }

        const matched = PREFIX_TO_LAYER.find((entry) => raw.startsWith(entry.prefix));
        if (!matched) {
            throw new EntityError(
                `Unknown locationId prefix in '${raw}'. Expected one of: ${PREFIX_TO_LAYER.map((e) => e.prefix).join(', ')}`,
                'locationId',
            );
        }

        this.value = raw;
        this.layer = matched.layer;
    }
}
