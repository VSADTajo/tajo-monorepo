import { ParameterIdValueObject } from './parameter-id.value-object';
import { EntityError } from '@domain/errors/entity.error';

describe('ParameterIdValueObject', () => {
    // ────────────────────────────────────────────────────────────
    // Happy paths
    // ────────────────────────────────────────────────────────────

    it('parses P.areal.ens.subcNAM.Med.24h into structured fields', () => {
        const vo = new ParameterIdValueObject('P.areal.ens.subcNAM.Med.24h');
        expect(vo.value).toBe('P.areal.ens.subcNAM.Med.24h');
        expect(vo.provider).toBe('ens');
        expect(vo.layer).toBe('subcNAM');
        expect(vo.stat).toBe('Med');
        expect(vo.accumulation).toBe('24h');
    });

    it('normalizes the accumulation suffix from uppercase (12H → 12h)', () => {
        // Harmonie files use uppercase suffix like .12H
        const vo = new ParameterIdValueObject('P.areal.harmonie.aemet.12H');
        expect(vo.provider).toBe('harmonie');
        expect(vo.layer).toBe('aemet');
        expect(vo.stat).toBeNull();
        expect(vo.accumulation).toBe('12h');
    });

    it('parses SAIH obs series with sis10 layer token and strips trailing .v suffix', () => {
        // Real SAIH parameterId: P.areal.obs.sis10.1h.v
        const vo = new ParameterIdValueObject('P.areal.obs.sis10.1h.v');
        expect(vo.provider).toBe('obs');
        expect(vo.layer).toBe('sistema'); // sis10 maps to sistema
        expect(vo.stat).toBeNull();
        expect(vo.accumulation).toBe('1h');
    });

    it('defaults missing accumulation suffix to 1h', () => {
        // e.g. P.areal.harmonie.subcNAM (no accum suffix)
        const vo = new ParameterIdValueObject('P.areal.harmonie.subcNAM');
        expect(vo.provider).toBe('harmonie');
        expect(vo.layer).toBe('subcNAM');
        expect(vo.stat).toBeNull();
        expect(vo.accumulation).toBe('1h');
    });

    it('parses EPS Med with no accumulation suffix (defaults to 1h)', () => {
        // Real EPS parameterId: P.areal.ens.sis10.Med (no accum)
        const vo = new ParameterIdValueObject('P.areal.ens.sis10.Med');
        expect(vo.provider).toBe('ens');
        expect(vo.layer).toBe('sistema');
        expect(vo.stat).toBe('Med');
        expect(vo.accumulation).toBe('1h');
    });

    it('exposes the raw string via .value', () => {
        const raw = 'P.areal.ens.subcNAM.Max.24h';
        const vo = new ParameterIdValueObject(raw);
        expect(vo.value).toBe(raw);
    });

    // ────────────────────────────────────────────────────────────
    // Rejection cases — EntityError expected
    // ────────────────────────────────────────────────────────────

    it('rejects unknown provider (e.g. P.areal.unknown.subcNAM)', () => {
        expect(() => new ParameterIdValueObject('P.areal.unknown.subcNAM')).toThrow(EntityError);
    });

    it('rejects unknown layer token (e.g. P.areal.harmonie.foo)', () => {
        expect(() => new ParameterIdValueObject('P.areal.harmonie.foo')).toThrow(EntityError);
    });

    it('rejects stat on non-ens provider (P.areal.harmonie.subcNAM.Max.24h)', () => {
        expect(() => new ParameterIdValueObject('P.areal.harmonie.subcNAM.Max.24h')).toThrow(EntityError);
    });

    it('rejects wrong prefix (Q.NAM.forecast)', () => {
        expect(() => new ParameterIdValueObject('Q.NAM.forecast')).toThrow(EntityError);
    });

    it('rejects empty string', () => {
        expect(() => new ParameterIdValueObject('')).toThrow(EntityError);
    });
});
