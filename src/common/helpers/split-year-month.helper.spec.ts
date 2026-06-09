import { splitYearMonth } from './split-year-month.helper';

describe('splitYearMonth', () => {
    it('should split a valid 6-digit date string into year and month', () => {
        const result = splitYearMonth('202404');
        expect(result).toEqual({ year: '2024', month: '04' });
    });

    it('should throw an error if the date string is shorter than 6 characters', () => {
        expect(() => splitYearMonth('2024')).toThrow('The date string must be exactly 6 characters long.');
    });

    it('should throw an error if the date string is longer than 6 characters', () => {
        expect(() => splitYearMonth('20240101')).toThrow('The date string must be exactly 6 characters long.');
    });

    it('should correctly parse edge case like December', () => {
        const result = splitYearMonth('202412');
        expect(result).toEqual({ year: '2024', month: '12' });
    });
});
