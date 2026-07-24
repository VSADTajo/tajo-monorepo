import { LocationIdValueObject } from './location-id.value-object';
import { EntityError } from '@domain/errors/entity.error';

describe('LocationIdValueObject', () => {
    // ────────────────────────────────────────────────────────────
    // Happy paths
    // ────────────────────────────────────────────────────────────

    it('accepts Sistema.Tajo.3 and derives layer=sistema', () => {
        const vo = new LocationIdValueObject('Sistema.Tajo.3');
        expect(vo.value).toBe('Sistema.Tajo.3');
        expect(vo.layer).toBe('sistema');
    });

    it('accepts Sistema.Tajo.10 and derives layer=sistema', () => {
        const vo = new LocationIdValueObject('Sistema.Tajo.10');
        expect(vo.value).toBe('Sistema.Tajo.10');
        expect(vo.layer).toBe('sistema');
    });

    it('accepts Cuenca.NAM.E_08 and derives layer=subcNAM', () => {
        const vo = new LocationIdValueObject('Cuenca.NAM.E_08');
        expect(vo.value).toBe('Cuenca.NAM.E_08');
        expect(vo.layer).toBe('subcNAM');
    });

    it('accepts Cuenca.NAM.AR01 (alphanumeric code) and derives layer=subcNAM', () => {
        const vo = new LocationIdValueObject('Cuenca.NAM.AR01');
        expect(vo.value).toBe('Cuenca.NAM.AR01');
        expect(vo.layer).toBe('subcNAM');
    });

    it('accepts Cuenca.AEMET.1 and derives layer=aemet', () => {
        const vo = new LocationIdValueObject('Cuenca.AEMET.1');
        expect(vo.value).toBe('Cuenca.AEMET.1');
        expect(vo.layer).toBe('aemet');
    });

    it('accepts Cuenca.AEMET.27 and derives layer=aemet', () => {
        const vo = new LocationIdValueObject('Cuenca.AEMET.27');
        expect(vo.value).toBe('Cuenca.AEMET.27');
        expect(vo.layer).toBe('aemet');
    });

    // ────────────────────────────────────────────────────────────
    // Rejection cases — EntityError expected
    // ────────────────────────────────────────────────────────────

    it('rejects empty string', () => {
        expect(() => new LocationIdValueObject('')).toThrow(EntityError);
    });

    it('rejects unknown prefix (Foo.bar)', () => {
        expect(() => new LocationIdValueObject('Foo.bar')).toThrow(EntityError);
    });

    it('rejects Cuenca.UNKNOWN.1 (unknown sub-prefix)', () => {
        expect(() => new LocationIdValueObject('Cuenca.UNKNOWN.1')).toThrow(EntityError);
    });
});
