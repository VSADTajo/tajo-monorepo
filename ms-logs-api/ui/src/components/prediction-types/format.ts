/** Days within which a last entry is considered "fresh" (green). Older → stale (red / FALTA). */
export const FRESH_WITHIN_DAYS = 3;

export type CoverageState = 'fresh' | 'stale' | 'never';

/**
 * Classifies a cell from its last-entry timestamp:
 *  - 'never': the station never received this type       → gray "-"
 *  - 'fresh': last entry within FRESH_WITHIN_DAYS         → green (shows date)
 *  - 'stale': last entry older than that (had it, stopped) → red "FALTA" (still shows the date)
 */
export function coverageState(iso: string | null, now: number = Date.now()): CoverageState {
    if (!iso) return 'never';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return 'never';
    const ageDays = (now - then) / (24 * 60 * 60 * 1000);
    return ageDays <= FRESH_WITHIN_DAYS ? 'fresh' : 'stale';
}

/** Format an ISO timestamp as a short local date-time, or "—" when null. */
export function formatLastEntered(iso: string | null): string {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('es-ES', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/** Human relative distance from now (e.g. "hace 3 h", "hace 2 d"), or "nunca" when null. */
export function relativeFromNow(iso: string | null): string {
    if (!iso) return 'nunca';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return 'nunca';
    const diffMs = Date.now() - then;
    const minutes = Math.round(diffMs / 60000);
    if (minutes < 1) return 'recién';
    if (minutes < 60) return `hace ${minutes} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `hace ${hours} h`;
    const days = Math.round(hours / 24);
    return `hace ${days} d`;
}
