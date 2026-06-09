export function splitYearMonth(dateString: string): { year: string; month: string } {
    if (dateString.length !== 6) {
        throw new Error('The date string must be exactly 6 characters long.');
    }

    const year = dateString.slice(0, 4);
    const month = dateString.slice(4, 6);

    return { year, month };
}
