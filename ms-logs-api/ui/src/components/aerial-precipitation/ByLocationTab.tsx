import { useState } from 'react';
import type {
    AerialAccumulation,
    AerialProvider,
    AerialSeries,
} from '../../types/aerial-precipitation';
import { getAerialPrecipitationByLocation } from './api';

interface Props {
    onResult: (rows: AerialSeries[], summary: string, raw: unknown) => void;
    onError: (msg: string) => void;
}

const PROVIDERS: AerialProvider[] = ['ens', 'harmonie', 'obs'];
const ACCUMULATIONS: AerialAccumulation[] = ['1h', '12h', '24h'];

export default function ByLocationTab({ onResult, onError }: Props) {
    const [locationId, setLocationId] = useState('Cuenca.NAM.E_08');
    const [provider, setProvider] = useState<AerialProvider | ''>('');
    const [accumulation, setAccumulation] = useState<AerialAccumulation | ''>('');
    const [includeEvents, setIncludeEvents] = useState(false);
    const [loading, setLoading] = useState(false);

    const fetchByLocation = async () => {
        if (!locationId.trim()) return;
        setLoading(true);
        try {
            const res = await getAerialPrecipitationByLocation(locationId.trim(), {
                provider: provider || undefined,
                accumulation: accumulation || undefined,
                includeEvents,
            });
            const flat = res.groups.flatMap((g) => g.series);
            onResult(flat, `${res.groups.length} grupos · ${flat.length} series`, res);
        } catch (e: unknown) {
            onError(extractError(e));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
            <label className="flex flex-col gap-1 text-xs text-slate-400 col-span-2 md:col-span-2">
                <span>Location ID *</span>
                <input
                    type="text"
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                    placeholder="Cuenca.NAM.E_08"
                    className="rounded-md bg-slate-800 border border-slate-700 text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
                <span>Provider (opt)</span>
                <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as AerialProvider | '')}
                    className="rounded-md bg-slate-800 border border-slate-700 text-slate-100 px-3 py-2"
                >
                    <option value="">—</option>
                    {PROVIDERS.map((p) => (
                        <option key={p} value={p}>
                            {p}
                        </option>
                    ))}
                </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
                <span>Accumulation (opt)</span>
                <select
                    value={accumulation}
                    onChange={(e) => setAccumulation(e.target.value as AerialAccumulation | '')}
                    className="rounded-md bg-slate-800 border border-slate-700 text-slate-100 px-3 py-2"
                >
                    <option value="">—</option>
                    {ACCUMULATIONS.map((a) => (
                        <option key={a} value={a}>
                            {a}
                        </option>
                    ))}
                </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                    type="checkbox"
                    checked={includeEvents}
                    onChange={(e) => setIncludeEvents(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-sky-500"
                />
                includeEvents
            </label>
            <button
                onClick={fetchByLocation}
                disabled={loading || !locationId.trim()}
                className="rounded-md bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 font-medium transition-colors"
            >
                {loading ? 'Cargando…' : 'Fetch'}
            </button>
        </div>
    );
}

function extractError(e: unknown): string {
    if (e && typeof e === 'object' && 'response' in e) {
        const r = (e as { response?: { status?: number; data?: unknown } }).response;
        if (r?.status === 404) return 'Sin data para ese locationId (404)';
        const body =
            r?.data && typeof r.data === 'object'
                ? JSON.stringify(r.data)
                : String(r?.data ?? '');
        return `HTTP ${r?.status ?? '?'} ${body}`.trim();
    }
    if (e instanceof Error) return e.message;
    return String(e);
}
