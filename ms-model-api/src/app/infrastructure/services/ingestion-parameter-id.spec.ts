import { toIngestionParameterId, toIngestionSeriesId } from './ingestion-parameter-id';

describe('toIngestionParameterId()', () => {
    it.each([
        ['FICT99.Validado', 'FICT99.historical'],
        ['FICT98.Validado', 'FICT98.historical'],
        ['FICT95.Validado', 'FICT95.historical'],
        ['VICT01.Validado', 'VICT01.historical'],
        ['WI__01.Horario', 'WI__01.historical'],
        ['WI__01.Total.Horario', 'WI__01.historical'],
        ['FI__01.Validado', 'FI__01.historical'],
        ['LICT01.Validado', 'LICT01.historical'],
    ])('keeps "." qualified names on their signal code: %s -> %s', (name, expected) => {
        expect(toIngestionParameterId(name)).toBe(expected);
    });

    // Real names found in prod for 12 reservoirs whose inflow never reached the UI.
    it.each(['FICT99_Calculado', 'FICT99_Calculado_1h', 'FICT99_Calculado-2', 'FICT99_Calculado_2h_opcon_v3'])(
        'maps the "_" qualified inflow variant %s onto FICT99.historical',
        (name) => {
            expect(toIngestionParameterId(name)).toBe('FICT99.historical');
        },
    );

    it('never cuts the "__" inside WI__/FI__/LI__ codes', () => {
        expect(toIngestionParameterId('WI__01')).toBe('WI__01.historical');
        expect(toIngestionParameterId('LI__01.Validado')).toBe('LI__01.historical');
    });

    it('falls back to the first "." segment when the name has no signal code', () => {
        expect(toIngestionParameterId('15m.Validado')).toBe('15m.historical');
        expect(toIngestionParameterId('something')).toBe('something.historical');
    });
});

describe('toIngestionSeriesId()', () => {
    it('returns an empty string for an empty name so callers can fall back', () => {
        expect(toIngestionSeriesId('')).toBe('');
    });
});
