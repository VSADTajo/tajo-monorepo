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
