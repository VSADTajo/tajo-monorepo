import { useMemo, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getCoverageMatrix, downloadCoverageMatrixReport } from './api';
import { coverageState, formatLastEntered, FRESH_WITHIN_DAYS } from './format';

export default function CoverageMatrixPanel() {
    const [onlyProblems, setOnlyProblems] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [downloadError, setDownloadError] = useState<string | null>(null);

    const { data, isFetching, isError, error } = useQuery({
        queryKey: ['prediction-types-coverage-matrix'],
        queryFn: getCoverageMatrix,
        staleTime: 60 * 1000,
    });

    const stations = useMemo(() => {
        const all = data?.stations ?? [];
        if (!onlyProblems) return all;
        // "Con faltas" = at least one type this station had but stopped receiving (stale / red).
        return all.filter((s) => s.cells.some((c) => coverageState(c) === 'stale'));
    }, [data, onlyProblems]);

    const handleDownload = async () => {
        setDownloading(true);
        setDownloadError(null);
        try {
            await downloadCoverageMatrixReport();
        } catch (err) {
            setDownloadError(err instanceof Error ? err.message : 'No se pudo generar el Excel');
        } finally {
            setDownloading(false);
        }
    };

    const types = data?.types ?? [];

    return (
        <div className="flex-1 overflow-auto p-6">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div>
                    <h2 className="text-sm font-semibold text-slate-200">
                        Cobertura de todas las estaciones
                    </h2>
                    {data && (
                        <>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {data.stations.length} estaciones × {types.length} types · última entrada por celda
                            </p>
                            <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                                <span className="flex items-center gap-1">
                                    <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500/40" /> con dato (≤{FRESH_WITHIN_DAYS}d)
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-500/40" /> FALTA (dejó de llegar)
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="inline-block w-2.5 h-2.5 rounded-sm bg-slate-600" /> - nunca recibió
                                </span>
                            </div>
                        </>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={onlyProblems}
                            onChange={(e) => setOnlyProblems(e.target.checked)}
                            className="accent-indigo-500"
                        />
                        Sólo con faltas
                    </label>
                    <button
                        onClick={handleDownload}
                        disabled={downloading || !data}
                        className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs rounded-lg font-medium transition-colors"
                    >
                        {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Exportar .xlsx
                    </button>
                </div>
            </div>

            {downloadError && (
                <p className="text-xs text-red-400 mb-3">Error al exportar: {downloadError}</p>
            )}

            {isFetching && <p className="text-center text-slate-500 py-8">Cargando cobertura…</p>}
            {isError && (
                <p className="text-center text-red-400 py-8">
                    Error al cargar: {error instanceof Error ? error.message : 'intento fallido'}
                </p>
            )}

            {data && !isFetching && (
                <div className="overflow-auto border border-slate-700/50 rounded-lg">
                    <table className="min-w-full text-xs">
                        <thead>
                            <tr className="bg-slate-900 text-slate-300">
                                <th className="sticky left-0 z-10 bg-slate-900 px-3 py-2 text-left font-semibold border-b border-slate-700">
                                    Estación
                                </th>
                                {types.map((t) => (
                                    <th
                                        key={t.id}
                                        className="px-3 py-2 text-left font-medium whitespace-nowrap border-b border-slate-700"
                                        title={`${t.name} (${t.unit})`}
                                    >
                                        {t.name}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {stations.map((s) => (
                                <tr key={s.stationCode} className="border-b border-slate-800/70">
                                    <td className="sticky left-0 z-10 bg-slate-950 px-3 py-2 border-r border-slate-800">
                                        <span className="font-medium text-slate-200">{s.stationCode}</span>
                                        {s.stationName && (
                                            <span className="text-slate-500 ml-2">{s.stationName}</span>
                                        )}
                                    </td>
                                    {s.cells.map((cell, index) => {
                                        const state = coverageState(cell);
                                        const cls =
                                            state === 'fresh'
                                                ? 'text-emerald-300 bg-emerald-500/5'
                                                : state === 'stale'
                                                  ? 'text-red-300 bg-red-500/10 font-medium'
                                                  : 'text-slate-600';
                                        return (
                                            <td
                                                key={types[index]?.id ?? index}
                                                className={`px-3 py-2 whitespace-nowrap ${cls}`}
                                                title={cell ? formatLastEntered(cell) : 'Nunca recibió este type'}
                                            >
                                                {state === 'fresh' && formatLastEntered(cell)}
                                                {state === 'stale' && (
                                                    <span>
                                                        FALTA
                                                        <span className="text-red-400/60 ml-1">· {formatLastEntered(cell)}</span>
                                                    </span>
                                                )}
                                                {state === 'never' && '-'}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {stations.length === 0 && (
                        <p className="text-center text-slate-600 py-8">No hay estaciones para mostrar.</p>
                    )}
                </div>
            )}
        </div>
    );
}
