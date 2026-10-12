import { EntityError } from '@domain/errors/entity.error';
import {
    PrecipAccumulationSource,
    PrecipAccumulationWindowValueObject,
} from '@domain/value-objects/precip-accumulation-window.value-object';

describe('PrecipAccumulationWindowValueObject', () => {
    it.each([
        [PrecipAccumulationSource.OBSERVED, 'WI__01.historical'],
        [PrecipAccumulationSource.HARMONIE, 'P.harmonie.forecast'],
        [PrecipAccumulationSource.EPS, 'P.ens.forecast'],
    ])('reads the %s source from %s', (source, predictionType) => {
        expect(new PrecipAccumulationWindowValueObject(source, 12).predictionType).toBe(predictionType);
    });

    it.each([1, 2, 4, 8, 12, 24])('accepts the AEMET horizon of %dh', (hours) => {
        expect(new PrecipAccumulationWindowValueObject('observed', hours).hours).toBe(hours);
    });

    it.each([0, 3, 6, 48, -1, 1.5])('rejects %dh, which has no AEMET threshold', (hours) => {
        expect(() => new PrecipAccumulationWindowValueObject('observed', hours)).toThrow(EntityError);
    });

    it('rejects an unknown source', () => {
        expect(() => new PrecipAccumulationWindowValueObject('wrf', 12)).toThrow(EntityError);
    });

    describe('isStale()', () => {
        const referenceDate = new Date('2026-10-12T18:00:00Z');

        it('keeps an observed station live up to 3 hours after its last measurement', () => {
            const window = new PrecipAccumulationWindowValueObject('observed', 1);

            expect(window.isStale(new Date('2026-10-12T15:00:00Z'), referenceDate)).toBe(false);
        });

        it('marks an observed station stale past 3 hours without measurements', () => {
            const window = new PrecipAccumulationWindowValueObject('observed', 1);

            expect(window.isStale(new Date('2026-10-12T14:59:00Z'), referenceDate)).toBe(true);
        });

        it('never marks a forecast stale', () => {
            const window = new PrecipAccumulationWindowValueObject('harmonie', 1);

            expect(window.isStale(new Date('2026-10-01T00:00:00Z'), referenceDate)).toBe(false);
        });
    });
});
