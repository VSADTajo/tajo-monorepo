import { useState } from 'react';
import type {
    AerialAccumulation,
    AerialLayer,
    AerialProvider,
    AerialSeries,
    AerialStat,
} from '../../types/aerial-precipitation';
import { getLatestAerialPrecipitation } from './api';

interface Props {
    onResult: (rows: AerialSeries[], summary: string, raw: unknown) => void;
    onError: (msg: string) => void;
}

const LAYERS: AerialLayer[] = ['sistema', 'aemet', 'subcNAM'];
const PROVIDERS: AerialProvider[] = ['ens', 'harmonie', 'obs'];
const ACCUMULATIONS: AerialAccumulation[] = ['1h', '12h', '24h'];
const STATS: Array<Exclude<AerialStat, null>> = ['Med', 'Max'];

export default function LatestTab({ onResult, onError }: Props) {
    const [layer, setLayer] = useState<AerialLayer>('subcNAM');
    const [provider, setProvider] = useState<AerialProvider>('ens');
    const [accumulation, setAccumulation] = useState<AerialAccumulation>('24h');
    const [stat, setStat] = useState<Exclude<AerialStat, null> | ''>('Med');
    const [includeEvents, setIncludeEvents] = useState(false);
    const [loading, setLoading] = useState(false);

    const fetchLatest = async () => {
        setLoading(true);
        try {
            const res = await getLatestAerialPrecipitation({
                layer,
                provider,
                accumulation,
                stat: stat || undefined,
                includeEvents,
            });
            onResult(
                res.series,
                `${res.series.length} series · generated ${new Date(res.generatedAt).toLocaleTimeString()}`,
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
            <Select label="Layer *" value={layer} options={LAYERS} onChange={setLayer} />
            <Select
                label="Provider *"
                value={provider}
                options={PROVIDERS}
                onChange={setProvider}
            />
            <Select
                label="Accumulation *"
                value={accumulation}
                options={ACCUMULATIONS}
                onChange={setAccumulation}
            />
            <Select
                label="Stat (solo EPS)"
                value={stat}
                options={['', ...STATS]}
                onChange={(v) => setStat(v as Exclude<AerialStat, null> | '')}
                placeholder="—"
            />
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
                onClick={fetchLatest}
                disabled={loading}
                className="rounded-md bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 font-medium transition-colors"
            >
                {loading ? 'Cargando…' : 'Fetch'}
            </button>
        </div>
    );
}

function Select<T extends string>({
    label,
    value,
    options,
    onChange,
    placeholder,
}: {
    label: string;
    value: T | '';
    options: readonly (T | '')[];
    onChange: (v: T) => void;
    placeholder?: string;
}) {
    return (
        <label className="flex flex-col gap-1 text-xs text-slate-400">
            <span>{label}</span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value as T)}
                className="rounded-md bg-slate-800 border border-slate-700 text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
                {options.map((opt) => (
                    <option key={opt} value={opt}>
                        {opt === '' ? (placeholder ?? '—') : opt}
                    </option>
                ))}
            </select>
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
