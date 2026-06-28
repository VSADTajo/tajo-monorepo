// Shared status badge styling for manual simulations.

export function statusBadgeClass(status: string): string {
    const s = status.toUpperCase();
    if (s === 'FINALIZED') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    if (s === 'MODEL_FAILED') return 'bg-red-500/15 text-red-300 border-red-500/30';
    if (s === 'CREATED') return 'bg-slate-600/20 text-slate-300 border-slate-600/40';
    return 'bg-amber-500/15 text-amber-300 border-amber-500/30'; // MODEL_PROCESSING / IN_PROGRESS
}
