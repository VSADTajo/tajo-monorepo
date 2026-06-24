import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownUp, Download, Info, TrendingUp, X } from 'lucide-react';
import SearchableSelect from '../hydro/SearchableSelect';
import { getForecastSeries, listPredictionTypes } from './api';
import { formatIsoDate, formatSimDate } from './format';
import SeriesChart, { type ChartSeries } from './SeriesChart';
import type { ForecastResultPoint, SimulationItem } from './types';

interface SimulationSeriesModalProps {
    stationCode: string;
    stationName: string;
    simulation: SimulationItem;
    onClose: () => void;
}

interface SummaryPoint {
    value: number;
    date: string;
}

const PALETTE = ['#818cf8', '#34d399', '#fbbf24', '#f87171', '#22d3ee', '#c084fc'];

function computeSummary(points: ForecastResultPoint[]): { max: SummaryPoint | null; latest: SummaryPoint | null } {
    if (points.length === 0) return { max: null, latest: null };
    let max = points[0];
    let latest = points[0];
    for (const point of points) {
        if (point.value > max.value) max = point;
        if (point.date > latest.date) latest = point;
    }
    return {
        max: { value: max.value, date: max.date },
        latest: { value: latest.value, date: latest.date },
    };
}

// Prefix formula-trigger characters with a quote so spreadsheets don't execute them (CSV injection / OWASP).
function sanitizeCsvCell(value: string): string {
    const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return `"${guarded.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: string[][]): void {
    const csv = rows.map((row) => row.map(sanitizeCsvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

export default function SimulationSeriesModal({ stationCode, stationName, simulation, onClose }: SimulationSeriesModalProps) {
    const [predictionType, setPredictionType] = useState('');
    const isHistorical = simulation.dataOrigin === 'HISTORICAL';

    const { data: typesData } = useQuery({
        queryKey: ['prediction-types'],
        queryFn: ({ signal }) => listPredictionTypes(signal),
        staleTime: 10 * 60 * 1000,
        enabled: !isHistorical,
    });

    const typeOptions = (typesData?.predictionTypes ?? []).map((t) => ({ value: t.name, label: t.name }));
    const unit = typesData?.predictionTypes.find((t) => t.name === predictionType)?.unit ?? '';

    const {
        data: forecast,
        isLoading,
        isError,
    } = useQuery({
        queryKey: ['forecast', stationCode, simulation.simulationDate, predictionType],
        queryFn: ({ signal }) =>
            getForecastSeries(
                { stationCode, simulationDate: simulation.simulationDate, predictionType },
                signal,
            ),
        enabled: !isHistorical && !!predictionType,
        staleTime: 60 * 1000,
    });

    const predictions = forecast?.predictions ?? [];
    const allPoints = useMemo(() => predictions.flatMap((p) => p.results), [predictions]);
    const summary = useMemo(() => computeSummary(allPoints), [allPoints]);

    const chartSeries: ChartSeries[] = useMemo(
        () =>
            predictions.map((p, index) => ({
                label: p.percentile != null ? `P${p.percentile}` : 'Serie',
                color: PALETTE[index % PALETTE.length],
                points: p.results.map((r) => ({ date: r.date, value: r.value })),
            })),
        [predictions],
    );

    function handleExport() {
        const rows: string[][] = [['percentile', 'date', 'value', 'flag']];
        for (const prediction of predictions) {
            for (const point of prediction.results) {
                rows.push([
                    prediction.percentile != null ? String(prediction.percentile) : '',
                    point.date,
                    String(point.value),
                    String(point.flag),
                ]);
            }
        }
        const safeName = [stationCode, simulation.simulationDate, predictionType]
            .map((part) => part.replace(/[^\w-]/g, '_'))
            .join('_');
        downloadCsv(`serie_${safeName}.csv`, rows);
    }

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-start justify-between px-5 py-4 border-b border-slate-700/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30">
                            <TrendingUp className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-slate-100">Serie de prediccion</h3>
                            <p className="text-xs text-slate-400">
                                {stationName} ({stationCode}) &middot; Simulacion {formatSimDate(simulation.simulationDate)}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
                        <X size={18} />
                    </button>
                </div>

                {isHistorical ? (
                    <div className="px-5 py-10">
                        <div className="flex items-start gap-3 max-w-xl mx-auto text-slate-400">
                            <Info size={18} className="text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-sm">
                                Esta es una simulacion <span className="text-slate-200">historica</span>. Las series
                                historicas se consultan por rango de fecha, no por simulacion, asi que este visor de
                                forecast no aplica. Para ver datos por simulacion, usa una simulacion de tipo{' '}
                                <span className="text-slate-200">Forecast</span>.
                            </p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Type selector + export */}
                        <div className="px-5 py-4 border-b border-slate-700/50 flex items-end justify-between gap-3">
                            <div>
                                <label className="text-xs text-slate-400 mb-1.5 block">Tipo de prediccion</label>
                                <SearchableSelect
                                    options={typeOptions}
                                    value={predictionType}
                                    onChange={setPredictionType}
                                    placeholder="Seleccionar tipo"
                                    className="w-72"
                                />
                            </div>
                            {allPoints.length > 0 && (
                                <button
                                    onClick={handleExport}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded-lg transition-colors"
                                >
                                    <Download size={14} />
                                    Exportar CSV
                                </button>
                            )}
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-auto px-5 py-4">
                            {!predictionType ? (
                                <p className="text-center text-slate-600 py-10">Selecciona un tipo para ver la serie</p>
                            ) : isLoading ? (
                                <p className="text-center text-slate-500 py-10">Cargando serie...</p>
                            ) : isError ? (
                                <p className="text-center text-red-400 py-10">Error al cargar la serie de prediccion</p>
                            ) : allPoints.length === 0 ? (
                                <p className="text-center text-slate-600 py-10">No hay datos para esta simulacion y tipo</p>
                            ) : (
                                <div className="space-y-5">
                                    {/* Summary cards */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-slate-900/60 border border-slate-700/50 rounded-lg px-4 py-3">
                                            <p className="text-xs text-slate-500">Valor maximo</p>
                                            <p className="text-lg font-semibold text-indigo-300">
                                                {summary.max?.value ?? 'N/A'} <span className="text-xs text-slate-500">{unit}</span>
                                            </p>
                                            <p className="text-xs text-slate-500 mt-0.5">{formatIsoDate(summary.max?.date ?? null)}</p>
                                        </div>
                                        <div className="bg-slate-900/60 border border-slate-700/50 rounded-lg px-4 py-3">
                                            <p className="text-xs text-slate-500">Ultimo valor</p>
                                            <p className="text-lg font-semibold text-slate-200">
                                                {summary.latest?.value ?? 'N/A'} <span className="text-xs text-slate-500">{unit}</span>
                                            </p>
                                            <p className="text-xs text-slate-500 mt-0.5">{formatIsoDate(summary.latest?.date ?? null)}</p>
                                        </div>
                                    </div>

                                    {/* Line chart */}
                                    <SeriesChart series={chartSeries} unit={unit} />

                                    {/* One table per percentile group */}
                                    {predictions.map((prediction) => {
                                        const rows = [...prediction.results].sort((a, b) => a.date.localeCompare(b.date));
                                        return (
                                            <div key={prediction.id}>
                                                <div className="flex items-center gap-2 mb-2 text-xs text-slate-400">
                                                    <ArrowDownUp size={12} />
                                                    <span>
                                                        {prediction.percentile != null
                                                            ? `Percentil ${prediction.percentile}`
                                                            : 'Serie'}
                                                    </span>
                                                    {prediction.predictionProvider && (
                                                        <span className="text-slate-600">&middot; {prediction.predictionProvider}</span>
                                                    )}
                                                    <span className="text-slate-600">&middot; {rows.length} puntos</span>
                                                </div>
                                                <div className="border border-slate-700/50 rounded-lg overflow-hidden">
                                                    <table className="w-full text-xs">
                                                        <thead>
                                                            <tr className="bg-slate-800/60 text-slate-400">
                                                                <th className="text-left font-medium px-4 py-2">Fecha</th>
                                                                <th className="text-right font-medium px-4 py-2">Valor ({unit || '-'})</th>
                                                                <th className="text-right font-medium px-4 py-2 w-16">Flag</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {rows.map((point) => (
                                                                <tr key={point.id} className="border-t border-slate-700/50 hover:bg-slate-800/30">
                                                                    <td className="px-4 py-2 text-slate-300">{formatIsoDate(point.date)}</td>
                                                                    <td className="px-4 py-2 text-right text-slate-200">{point.value}</td>
                                                                    <td className="px-4 py-2 text-right text-slate-500">{point.flag}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
