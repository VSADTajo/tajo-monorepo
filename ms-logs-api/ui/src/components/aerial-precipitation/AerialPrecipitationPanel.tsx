import { CloudRain } from 'lucide-react';
import { useState } from 'react';
import type { AerialSeries } from '../../types/aerial-precipitation';
import LatestTab from './LatestTab';
import ByLocationTab from './ByLocationTab';
import ListTab from './ListTab';
import SeriesTable from './SeriesTable';

type Tab = 'latest' | 'by-location' | 'list';

const TAB_LABELS: Record<Tab, string> = {
    latest: 'Última por polígono',
    'by-location': 'Por locationId',
    list: 'Listado paginado',
};

export default function AerialPrecipitationPanel() {
    const [activeTab, setActiveTab] = useState<Tab>('latest');
    const [rows, setRows] = useState<AerialSeries[]>([]);
    const [summary, setSummary] = useState<string | null>(null);
    const [rawJson, setRawJson] = useState<unknown>(null);
    const [error, setError] = useState<string | null>(null);
    const [showRaw, setShowRaw] = useState(false);

    const onResult = (
        newRows: AerialSeries[],
        newSummary: string,
        newRaw: unknown,
    ) => {
        setRows(newRows);
        setSummary(newSummary);
        setRawJson(newRaw);
        setError(null);
    };

    const onError = (msg: string) => {
        setRows([]);
        setSummary(null);
        setRawJson(null);
        setError(msg);
    };

    const onReset = () => {
        setRows([]);
        setSummary(null);
        setRawJson(null);
        setError(null);
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="border-b border-slate-700/50 bg-slate-900 px-6 py-4">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-sky-500/20 border border-sky-500/30">
                        <CloudRain className="w-5 h-5 text-sky-400" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-slate-100">Precipitación areal</h1>
                        <p className="text-xs text-slate-400">
                            Series FEWS por polígono (EPS / Harmonie / SAIH) — capas sistemas de
                            explotación, subcuencas NAM y AEMET meteoalerta.
                        </p>
                    </div>
                </div>
                <div className="flex gap-1">
                    {(['latest', 'by-location', 'list'] as Tab[]).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => {
                                setActiveTab(tab);
                                onReset();
                            }}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                activeTab === tab
                                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                            }`}
                        >
                            {TAB_LABELS[tab]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-auto p-6 space-y-4">
                {activeTab === 'latest' && <LatestTab onResult={onResult} onError={onError} />}
                {activeTab === 'by-location' && (
                    <ByLocationTab onResult={onResult} onError={onError} />
                )}
                {activeTab === 'list' && <ListTab onResult={onResult} onError={onError} />}

                {error && (
                    <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">
                        {error}
                    </div>
                )}

                {summary && (
                    <div className="text-xs text-slate-400 flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                            {summary}
                        </span>
                        {rawJson !== null && (
                            <button
                                onClick={() => setShowRaw((s) => !s)}
                                className="text-slate-500 hover:text-slate-300 underline"
                            >
                                {showRaw ? 'Ocultar' : 'Ver'} JSON crudo
                            </button>
                        )}
                    </div>
                )}

                {rows.length > 0 && <SeriesTable rows={rows} />}

                {showRaw && rawJson !== null && (
                    <pre className="text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 overflow-auto max-h-96 text-slate-300">
                        {JSON.stringify(rawJson, null, 2)}
                    </pre>
                )}
            </div>
        </div>
    );
}
