import { useState } from 'react';
import { Gauge, Download, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getPredictionTypesByStation, downloadStationReport } from './api';
import StationAutocomplete from './StationAutocomplete';
import CoverageMatrixPanel from './CoverageMatrixPanel';
import { formatLastEntered, relativeFromNow } from './format';

type Tab = 'station' | 'matrix';

export default function PredictionTypesPanel() {
    const [tab, setTab] = useState<Tab>('station');
    const [stationCode, setStationCode] = useState('');
    const [filter, setFilter] = useState<'all' | 'with-data' | 'never'>('all');
    const [downloading, setDownloading] = useState(false);
    const [downloadError, setDownloadError] = useState<string | null>(null);

    const { data, isFetching, isError, error } = useQuery({
        queryKey: ['prediction-types-by-station', stationCode],
        queryFn: () => getPredictionTypesByStation(stationCode),
        enabled: !!stationCode,
        staleTime: 60 * 1000,
    });

    const allTypes = data?.types ?? [];
    const types = allTypes.filter((t) => {
        if (filter === 'with-data') return t.hasData;
        if (filter === 'never') return !t.hasData;
        return true;
    });

    const handleDownload = async () => {
        if (!stationCode) return;
        setDownloading(true);
        setDownloadError(null);
        try {
            await downloadStationReport(stationCode);
        } catch (err) {
            setDownloadError(err instanceof Error ? err.message : 'No se pudo generar el Excel');
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="border-b border-slate-700/50 bg-slate-900 px-6 py-4">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30">
                        <Gauge className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-slate-100">Prediction Types</h1>
                        <p className="text-xs text-slate-400">
                            Cobertura de types por estación — con datos, nunca, y última entrada
                        </p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-4">
                    <button
                        onClick={() => setTab('station')}
                        className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                            tab === 'station'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                    >
                        Por estación
                    </button>
                    <button
                        onClick={() => setTab('matrix')}
                        className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                            tab === 'matrix'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                    >
                        Cobertura (todas)
                    </button>
                </div>

                {tab === 'station' && <StationAutocomplete onSelect={setStationCode} />}
            </div>

            {/* Content */}
            {tab === 'matrix' ? (
                <CoverageMatrixPanel />
            ) : (
                <div className="flex-1 overflow-auto p-6">
                    {!stationCode && (
                        <p className="text-center text-slate-500 py-8">
                            Ingresá o elegí una estación para ver la cobertura de todos sus prediction types.
                        </p>
                    )}

                    {stationCode && isFetching && (
                        <p className="text-center text-slate-500 py-8">Cargando cobertura de {stationCode}…</p>
                    )}

                    {stationCode && !isFetching && isError && (
                        <p className="text-center text-red-400 py-8">
                            Error al consultar: {error instanceof Error ? error.message : 'intento fallido'}
                        </p>
                    )}

                    {stationCode && !isFetching && !isError && data && (
                        <>
                            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                                <div>
                                    <h2 className="text-sm font-semibold text-slate-200">
                                        Estación {data.stationCode} — {data.withData} de {data.total} types con datos
                                    </h2>
                                    <div className="flex gap-1.5 mt-2">
                                        {(['all', 'with-data', 'never'] as const).map((f) => (
                                            <button
                                                key={f}
                                                onClick={() => setFilter(f)}
                                                className={`px-2.5 py-1 text-[11px] rounded-md font-medium transition-colors ${
                                                    filter === f
                                                        ? 'bg-slate-700 text-white'
                                                        : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
                                                }`}
                                            >
                                                {f === 'all' ? 'Todos' : f === 'with-data' ? 'Con datos' : 'Nunca'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <button
                                    onClick={handleDownload}
                                    disabled={downloading}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs rounded-lg font-medium transition-colors"
                                >
                                    {downloading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Download className="w-4 h-4" />
                                    )}
                                    Exportar .xlsx
                                </button>
                            </div>

                            {downloadError && (
                                <p className="text-xs text-red-400 mb-3">Error al exportar: {downloadError}</p>
                            )}

                            {allTypes.length === 0 ? (
                                <p className="text-center text-slate-600 py-8">
                                    No hay prediction types en el catálogo.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {types.map((t) => (
                                        <div
                                            key={t.id}
                                            className={`flex items-center gap-3 px-4 py-3 border rounded-lg ${
                                                t.hasData
                                                    ? 'border-slate-700/50 bg-slate-800/60'
                                                    : 'border-slate-800/60 bg-slate-900/40'
                                            }`}
                                        >
                                            <span
                                                className={`w-2 h-2 rounded-full shrink-0 ${
                                                    t.hasData ? 'bg-emerald-400' : 'bg-slate-600'
                                                }`}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p
                                                    className={`text-sm font-medium truncate ${
                                                        t.hasData ? 'text-slate-200' : 'text-slate-500'
                                                    }`}
                                                >
                                                    {t.name}
                                                </p>
                                            </div>
                                            <span
                                                className={`text-xs whitespace-nowrap ${
                                                    t.hasData ? 'text-slate-300' : 'text-slate-600 italic'
                                                }`}
                                                title={t.lastEntered ?? undefined}
                                            >
                                                {t.hasData
                                                    ? `${formatLastEntered(t.lastEntered)} · ${relativeFromNow(t.lastEntered)}`
                                                    : 'nunca'}
                                            </span>
                                            <span className="text-xs px-2 py-0.5 rounded border text-indigo-300 bg-indigo-400/10 border-indigo-500/30 shrink-0">
                                                {t.unit}
                                            </span>
                                        </div>
                                    ))}
                                    {types.length === 0 && (
                                        <p className="text-center text-slate-600 py-8">
                                            Sin types para este filtro.
                                        </p>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
