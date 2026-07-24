import { EntityError } from '@domain/errors/entity.error';

/** Valid providers as seen in production FEWS files. */
const VALID_PROVIDERS = ['ens', 'harmonie', 'obs'] as const;
type Provider = (typeof VALID_PROVIDERS)[number];

/** Layer tokens as they appear in the FEWS parameterId. */
const LAYER_TOKEN_MAP: Record<string, string> = {
    sis10: 'sistema',
    aemet: 'aemet',
    subcNAM: 'subcNAM',
};

/** Stats are only allowed for the EPS ensemble provider. */
const VALID_STATS = ['Med', 'Max'] as const;

/** Accumulation suffixes (case-insensitive input, stored lowercase). */
const VALID_ACCUMULATIONS = ['1h', '12h', '24h'] as const;

/**
 * Parses and validates a FEWS aerial-precipitation parameterId.
 *
 * Expected format: `P.areal.{provider}.{layer}[.{stat}][.{accum}][.v]`
 *
 * - provider: `ens` | `harmonie` | `obs`
 * - layer token: `sis10` (→ persisted as `sistema`), `aemet`, `subcNAM`
 * - stat: `Med` | `Max` — only when provider is `ens`
 * - accum: `1h` | `12h` | `24h` (case-insensitive, normalized to lowercase); defaults to `1h`
 * - `.v` trailing suffix (SAIH validated flag) is stripped silently
 *
 * Throws `EntityError` for any invalid input.
 */
export class ParameterIdValueObject {
    public readonly value: string;
    public readonly provider: string;
    public readonly layer: string;
    public readonly stat: string | null;
    public readonly accumulation: string;

    constructor(raw: string) {
        if (!raw) {
            throw new EntityError('parameterId is required', 'parameterId');
        }

        const segments = raw.split('.');

        // Must start with exactly P.areal
        if (segments[0] !== 'P' || segments[1] !== 'areal') {
            throw new EntityError(`parameterId must start with 'P.areal', got: ${raw}`, 'parameterId');
        }

        // Provider segment (index 2)
        const providerRaw = segments[2];
        if (!providerRaw || !(VALID_PROVIDERS as readonly string[]).includes(providerRaw)) {
            throw new EntityError(
                `Unknown provider '${providerRaw}' in parameterId '${raw}'. Valid: ${VALID_PROVIDERS.join(', ')}`,
                'parameterId',
            );
        }
        const provider = providerRaw as Provider;

        // Layer segment (index 3)
        const layerToken = segments[3];
        if (!layerToken || !(layerToken in LAYER_TOKEN_MAP)) {
            throw new EntityError(
                `Unknown layer token '${layerToken}' in parameterId '${raw}'. Valid: ${Object.keys(LAYER_TOKEN_MAP).join(', ')}`,
                'parameterId',
            );
        }
        const layer = LAYER_TOKEN_MAP[layerToken];

        // The remaining segments (indices 4+) can be:
        //   []             → no stat, no accum
        //   [accum]        → no stat, has accum
        //   [stat]         → has stat (ens only), no accum
        //   [stat, accum]  → has stat (ens only) + accum
        //   [..., 'v']     → trailing .v stripped first
        const remaining = segments.slice(4);

        // Strip trailing 'v' suffix (SAIH validated marker)
        if (remaining[remaining.length - 1] === 'v') {
            remaining.pop();
        }

        let stat: string | null = null;
        let accumulation = '1h'; // default per FEWS convention

        if (remaining.length === 0) {
            // No stat, no accum → defaults apply
        } else if (remaining.length === 1) {
            const token = remaining[0].toLowerCase();
            if (VALID_ACCUMULATIONS.includes(token as any)) {
                // It's an accumulation
                accumulation = token;
            } else if ((VALID_STATS as readonly string[]).includes(remaining[0])) {
                // It's a stat (case-sensitive per FEWS: Med/Max)
                if (provider !== 'ens') {
                    throw new EntityError(
                        `Stat '${remaining[0]}' is only valid for provider 'ens', got '${provider}' in '${raw}'`,
                        'parameterId',
                    );
                }
                stat = remaining[0];
            } else {
                throw new EntityError(`Unrecognized segment '${remaining[0]}' in parameterId '${raw}'`, 'parameterId');
            }
        } else if (remaining.length === 2) {
            // stat + accum
            const statCandidate = remaining[0];
            const accumCandidate = remaining[1].toLowerCase();

            if (!(VALID_STATS as readonly string[]).includes(statCandidate)) {
                throw new EntityError(
                    `Expected stat ('Med'|'Max') at position 4 but got '${statCandidate}' in '${raw}'`,
                    'parameterId',
                );
            }
            if (!VALID_ACCUMULATIONS.includes(accumCandidate as any)) {
                throw new EntityError(
                    `Expected accumulation ('1h'|'12h'|'24h') at position 5 but got '${remaining[1]}' in '${raw}'`,
                    'parameterId',
                );
            }
            if (provider !== 'ens') {
                throw new EntityError(
                    `Stat '${statCandidate}' is only valid for provider 'ens', got '${provider}' in '${raw}'`,
                    'parameterId',
                );
            }
            stat = statCandidate;
            accumulation = accumCandidate;
        } else {
            throw new EntityError(`Too many segments in parameterId '${raw}'`, 'parameterId');
        }

        this.value = raw;
        this.provider = provider;
        this.layer = layer;
        this.stat = stat;
        this.accumulation = accumulation;
    }
}
