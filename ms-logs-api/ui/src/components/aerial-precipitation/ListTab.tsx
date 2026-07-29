import { useState } from 'react';
import type {
    AerialAccumulation,
    AerialLayer,
    AerialProvider,
    AerialSeries,
    AerialStat,
} from '../../types/aerial-precipitation';
import { listAerialPrecipitation } from './api';

interface Props {
    onResult: (rows: AerialSeries[], summary: string, raw: unknown) => void;
    onError: (msg: string) => void;
}

const LAYERS: AerialLayer[] = ['sistema', 'aemet', 'subcNAM'];
const PROVIDERS: AerialProvider[] = ['ens', 'harmonie', 'obs'];
const ACCUMULATIONS: AerialAccumulation[] = ['1h', '12h', '24h'];
const STATS: Array<Exclude<AerialStat, null>> = ['Med', 'Max'];

export default function ListTab({ onResult, onError }: Props) {
    const [layer, setLayer] = useState<AerialLayer | ''>('');
    const [provider, setProvider] = useState<AerialProvider | ''>('');
    const [accumulation, setAccumulation] = useState<AerialAccumulation | ''>('');
    const [stat, setStat] = useState<Exclude<AerialStat, null> | ''>('');
    const [includeEvents, setIncludeEvents] = useState(false);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [loading, setLoading] = useState(false);

    const fetchList = async () => {
        setLoading(true);
        try {
            const res = await listAerialPrecipitation({
                layer: layer || undefined,
                provider: provider || undefined,
                accumulation: accumulation || undefined,
                stat: stat || undefined,
                includeEvents,
                page,
                limit,
            });
            const totalPages = res.limit > 0 ? Math.max(1, Math.ceil(res.total / res.limit)) : 1;
            onResult(
                res.data,
                `page ${res.page}/${totalPages} · ${res.data.length}/${res.total} series`,
                res,
            );
        } catch (e: unknown) {
            onError(extractError(e));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
            <SelectCol
                label="Layer (opt)"
                value={layer}
                options={['', ...LAYERS]}
                onChange={(v) => setLayer(v as AerialLayer | '')}
            />
            <SelectCol
                label="Provider (opt)"
                value={provider}
                options={['', ...PROVIDERS]}
                onChange={(v) => setProvider(v as AerialProvider | '')}
            />
            <SelectCol
                label="Accum (opt)"
                value={accumulation}
                options={['', ...ACCUMULATIONS]}
                onChange={(v) => setAccumulation(v as AerialAccumulation | '')}
            />
            <SelectCol
                label="Stat (opt)"
                value={stat}
                options={['', ...STATS]}
                onChange={(v) => setStat(v as Exclude<AerialStat, null> | '')}
            />
            <NumberCol
                label="Page"
                value={page}
                min={1}
                onChange={setPage}
            />
            <NumberCol label="Limit" value={limit} min={1} max={500} onChange={setLimit} />
            <label className="flex items-center gap-2 text-sm text-slate-300 col-span-2 md:col-span-1">
                <input
                    type="checkbox"
                    checked={includeEvents}
                    onChange={(e) => setIncludeEvents(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-sky-500"
                />
                includeEvents
            </label>
            <button
                onClick={fetchList}
                disabled={loading}
                className="rounded-md bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 font-medium transition-colors col-span-2 md:col-span-1"
            >
                {loading ? 'Cargando…' : 'Fetch'}
            </button>
        </div>
    );
}

function SelectCol({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: string;
    options: readonly string[];
    onChange: (v: string) => void;
}) {
    return (
        <label className="flex flex-col gap-1 text-xs text-slate-400">
            <span>{label}</span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="rounded-md bg-slate-800 border border-slate-700 text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
                {options.map((opt) => (
                    <option key={opt} value={opt}>
                        {opt === '' ? '—' : opt}
                    </option>
                ))}
            </select>
        </label>
    );
}

function NumberCol({
    label,
    value,
    min,
    max,
    onChange,
}: {
    label: string;
    value: number;
    min?: number;
    max?: number;
    onChange: (v: number) => void;
}) {
    return (
        <label className="flex flex-col gap-1 text-xs text-slate-400">
            <span>{label}</span>
            <input
                type="number"
                value={value}
                min={min}
                max={max}
                onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!Number.isNaN(v)) onChange(v);
                }}
                className="rounded-md bg-slate-800 border border-slate-700 text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
        </label>
    );
}

function extractError(e: unknown): string {
    if (e && typeof e === 'object' && 'response' in e) {
        const r = (e as { response?: { status?: number; data?: unknown } }).response;
        const body =
            r?.data && typeof r.data === 'object'
                ? JSON.stringify(r.data)
                : String(r?.data ?? '');
        return `HTTP ${r?.status ?? '?'} ${body}`.trim();
    }
    if (e instanceof Error) return e.message;
    return String(e);
}
