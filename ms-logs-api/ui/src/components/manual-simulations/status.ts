// Shared status presentation for manual simulations (badge color + human labels).

export function statusBadgeClass(status: string): string {
    const s = status.toUpperCase();
    if (s === 'FINALIZED') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    if (s === 'MODEL_FAILED') return 'bg-red-500/15 text-red-300 border-red-500/30';
    if (s === 'CREATED') return 'bg-slate-600/20 text-slate-300 border-slate-600/40';
    return 'bg-amber-500/15 text-amber-300 border-amber-500/30'; // MODEL_PROCESSING / IN_PROGRESS
}

/** Short label for badges, tables and filters. */
const STATUS_LABELS: Record<string, string> = {
    CREATED: 'Creada',
    MODEL_PROCESSING: 'Procesando',
    IN_PROGRESS: 'Recibiendo',
    FINALIZED: 'Finalizada',
    MODEL_FAILED: 'Falló',
};

/** Longer sentence for the monitor hero. */
const STATUS_DESCRIPTIONS: Record<string, string> = {
    CREATED: 'Creada',
    MODEL_PROCESSING: 'El modelo está procesando',
    IN_PROGRESS: 'Recibiendo resultados',
    FINALIZED: 'Finalizada',
    MODEL_FAILED: 'El modelo falló',
};

export function statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
}

export function statusDescription(status: string): string {
    return STATUS_DESCRIPTIONS[status] ?? status;
}
