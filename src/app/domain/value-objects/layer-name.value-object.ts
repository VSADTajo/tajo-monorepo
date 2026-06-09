import { ProviderNameValueObject } from './provider-name.value-object';
import { VariableNameValueObject } from './variable-name.value-object';

/**
 * Deterministic GeoServer layer name builder.
 *
 * Convention: `tajo:<provider>_<variable>` in lowercase snake_case.
 *   - LayerName.compose('HARMONIE', 'Precipitacion')   → 'tajo:harmonie_precipitacion'
 *   - LayerName.compose('EPS', 'Precipitacion_25')     → 'tajo:eps_precipitacion_25'
 *   - LayerName.compose('RADAR', null)                 → 'tajo:radar_precipitacion'  (RADAR's implicit dataset)
 */
export class LayerNameValueObject {
    public readonly workspace: string;
    public readonly bare: string;

    private constructor(workspace: string, bare: string) {
        this.workspace = workspace;
        this.bare = bare;
    }

    static compose(
        provider: string | ProviderNameValueObject,
        variable: string | VariableNameValueObject | null,
        workspace = 'tajo',
    ): LayerNameValueObject {
        const providerVo =
            provider instanceof ProviderNameValueObject ? provider : new ProviderNameValueObject(provider);
        const providerLower = providerVo.value.toLowerCase();

        // RADAR special case: implicit "precipitacion" variable.
        if (variable === null) {
            const radarVariable = providerLower === 'radar' ? 'precipitacion' : 'default';
            return new LayerNameValueObject(workspace, `${providerLower}_${radarVariable}`);
        }

        const variableVo =
            variable instanceof VariableNameValueObject ? variable : new VariableNameValueObject(variable);
        return new LayerNameValueObject(workspace, `${providerLower}_${variableVo.toSnakeCase()}`);
    }

    /** Full qualified name as used by WMS, e.g. `tajo:radar_precipitacion`. */
    toString(): string {
        return `${this.workspace}:${this.bare}`;
    }

    /** Bare name (no workspace prefix), used as the GeoServer store/coverage id. */
    bareName(): string {
        return this.bare;
    }

    /**
     * Derive an aggregated layer name by appending a suffix.
     *   e.g. `harmonie_precipitacion` + `diaria` → `harmonie_precipitacion_diaria`
     */
    withSuffix(suffix: string): LayerNameValueObject {
        if (!suffix) {
            throw new Error('Layer name suffix must be non-empty');
        }
        return new LayerNameValueObject(this.workspace, `${this.bare}_${suffix}`);
    }
}
