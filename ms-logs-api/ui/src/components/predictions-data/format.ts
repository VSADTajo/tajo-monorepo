// Display helpers — kept dumb on purpose so they never throw on unexpected input.

/** '20260129000000' → '2026-01-29 00:00'. Returns the raw string if it isn't a 14-digit stamp. */
export function formatSimDate(stamp: string): string {
    if (!/^\d{14}$/.test(stamp)) return stamp;
    const year = stamp.slice(0, 4);
    const month = stamp.slice(4, 6);
    const day = stamp.slice(6, 8);
    const hour = stamp.slice(8, 10);
    const minute = stamp.slice(10, 12);
    return `${year}-${month}-${day} ${hour}:${minute}`;
}

/** ISO 8601 → 'YYYY-MM-DD HH:mm' shown as-is (UTC, no timezone shifting). */
export function formatIsoDate(iso: string | null): string {
    if (!iso) return 'N/A';
    const match = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
    return match ? `${match[1]} ${match[2]}` : iso;
}
