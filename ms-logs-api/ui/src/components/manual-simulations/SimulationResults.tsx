import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Loader2, TableProperties } from 'lucide-react';

import SeriesChart, { type ChartSeries } from '../predictions-data/SeriesChart';
import { getManualSimulationResults } from './api';
import type { SimulationPrediction } from './types';

/**
 * The real outcome of a manual run: the volume balance, one row per reservoir.
 *
 * Shaped as a matrix rather than a flat list of predictions because that is the
 * shape of the domain — every reservoir gets one HARMONIE balance and five EPS
 * percentiles, so 38 reservoirs make 228 predictions that read as 38 rows.
 *
 * Empty cells are the norm today, and they say why instead of going blank: FEWS
 * delivers the inflow forecast filled with missing values for most reservoirs, and
 * sends no EPS series at all. A table that just showed 226 dashes would read as a
 * broken screen instead of as the upstream problem it is.
 */

/** Column order matches how the operator thinks about it: the deterministic run first. */
const EPS_PERCENTILES = [10, 25, 50, 75, 90] as const;

const SERIES_COLORS = ['#38bdf8', '#a78bfa', '#f472b6', '#fbbf24', '#34d399', '#60a5fa'];

interface SimulationResultsProps {
    simulationId: string;
}

interface ReservoirRow {
    code: string;
    name: string;
    unit: string;
    harmonie: SimulationPrediction | null;
    eps: Record<number, SimulationPrediction | null>;
}

/** Groups the flat prediction list into one row per reservoir. */
function toRows(predictions: SimulationPrediction[]): ReservoirRow[] {
    const byReservoir = new Map<string, ReservoirRow>();

    for (const prediction of predictions) {
        const code = prediction.stationId;
        if (!byReservoir.has(code)) {
            byReservoir.set(code, {
                code,
                name: prediction.station?.name ?? prediction.stationName ?? code,
                unit: prediction.predictionTypeUnit ?? '',
                harmonie: null,
                eps: {},
            });
        }
        const row = byReservoir.get(code)!;
        if (prediction.percentile === null || prediction.percentile === undefined) {
            row.harmonie = prediction;
        } else {
            row.eps[prediction.percentile] = prediction;
        }
    }

    return [...byReservoir.values()].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
}

function hasData(prediction: SimulationPrediction | null | undefined): boolean {
    return Boolean(prediction && (prediction.max || prediction.last));
}

function rowHasData(row: ReservoirRow): boolean {
    return hasData(row.harmonie) || EPS_PERCENTILES.some((p) => hasData(row.eps[p]));
}

function formatValue(prediction: SimulationPrediction | null | undefined): string {
    if (!hasData(prediction)) return '—';
    const point = prediction!.max ?? prediction!.last!;
    return point.value.toFixed(2);
}

export default function SimulationResults({ simulationId }: SimulationResultsProps) {
    const [predictions, setPredictions] = useState<SimulationPrediction[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [onlyWithData, setOnlyWithData] = useState(false);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [series, setSeries] = useState<Record<string, SimulationPrediction[]>>({});
    const [loadingSeries, setLoadingSeries] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        setPredictions(null);
        setError(null);

        getManualSimulationResults(simulationId, {}, controller.signal)
            .then((response) => setPredictions(response.predictions ?? []))
            .catch((cause: unknown) => {
                if (controller.signal.aborted) return;
                setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los resultados');
            });

        return () => controller.abort();
    }, [simulationId]);

    const rows = useMemo(() => toRows(predictions ?? []), [predictions]);
    const withData = useMemo(() => rows.filter(rowHasData), [rows]);
    const visible = onlyWithData ? withData : rows;

    const epsEmpty = useMemo(
        () => rows.length > 0 && rows.every((row) => EPS_PERCENTILES.every((p) => !hasData(row.eps[p]))),
        [rows],
    );

    /** Fetches the full series of one reservoir only — the whole set is megabytes. */
    async function toggleRow(code: string) {
        if (expanded === code) {
            setExpanded(null);
            return;
        }
        setExpanded(code);
        if (series[code]) return;

        setLoadingSeries(code);
        try {
            const response = await getManualSimulationResults(simulationId, {
                stationCode: code,
                withResults: true,
            });
            setSeries((prev) => ({ ...prev, [code]: response.predictions ?? [] }));
        } catch {
            setSeries((prev) => ({ ...prev, [code]: [] }));
        } finally {
            setLoadingSeries(null);
        }
    }

    if (error) {
        return (
            <p className="text-xs text-rose-300 border border-rose-500/30 bg-rose-500/10 rounded-lg px-4 py-3">
                {error}
            </p>
        );
    }

    if (predictions === null) {
        return (
            <p className="text-xs text-slate-500 flex items-center gap-2 px-1 py-3">
                <Loader2 size={13} className="animate-spin" /> Cargando resultados…
            </p>
        );
    }

    if (rows.length === 0) {
        return (
            <p className="text-xs text-slate-600 border border-dashed border-slate-700/60 rounded-lg px-4 py-4 text-center">
                Todavía no hay previsiones para esta simulación.
            </p>
        );
    }

    return (
        <div>
            <div className="flex items-center gap-2 mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                <TableProperties size={13} className="text-sky-400" />
                <span>Resultados · balance de volumen</span>
            </div>

            {/* The summary first: it answers "did the model produce anything" without
                making the operator scan the grid. */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="text-[11px] text-slate-400">
                    <span className="text-slate-200">{rows.length}</span> embalses ·{' '}
                    <span className={withData.length > 0 ? 'text-emerald-300' : 'text-amber-300'}>
                        {withData.length} con datos
                    </span>
                    {rows.length - withData.length > 0 && (
                        <>
                            {' '}
                            · <span className="text-slate-500">{rows.length - withData.length} sin caudal de entrada</span>
                        </>
                    )}
                </p>
                <button
                    type="button"
                    onClick={() => setOnlyWithData((value) => !value)}
                    className={`text-[10px] px-2 py-0.5 rounded-md border transition ${
                        onlyWithData
                            ? 'border-sky-500/40 text-sky-300 bg-sky-500/10'
                            : 'border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                >
                    solo con datos
                </button>
            </div>

            {epsEmpty && (
                <p className="text-[10px] text-amber-300/80 mb-2">
                    Las columnas EPS están vacías porque el modelo no envió series de EPS en esta corrida.
                </p>
            )}

            <div className="border border-slate-700/50 rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="text-[10px] uppercase tracking-wide text-slate-500 bg-slate-800/40">
                            <th className="text-left font-medium px-3 py-2">Embalse</th>
                            <th className="text-right font-medium px-3 py-2">Harmonie</th>
                            {EPS_PERCENTILES.map((p) => (
                                <th key={p} className="text-right font-medium px-3 py-2">
                                    P{p}
                                </th>
                            ))}
                            <th className="px-2 py-2" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/40">
                        {visible.map((row) => {
                            const isOpen = expanded === row.code;
                            const filled = rowHasData(row);
                            return (
                                <Fragment key={row.code}>
                                    <tr
                                        onClick={() => filled && toggleRow(row.code)}
                                        className={`${filled ? 'cursor-pointer hover:bg-slate-800/40' : 'opacity-50'} transition`}
                                    >
                                        <td className="px-3 py-2">
                                            <span className="text-slate-200">{row.code}</span>
                                            {row.name !== row.code && (
                                                <span className="text-slate-500 ml-2">{row.name}</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums text-slate-200">
                                            {formatValue(row.harmonie)}
                                        </td>
                                        {EPS_PERCENTILES.map((p) => (
                                            <td key={p} className="px-3 py-2 text-right tabular-nums text-slate-400">
                                                {formatValue(row.eps[p])}
                                            </td>
                                        ))}
                                        <td className="px-2 py-2 text-right">
                                            {filled && (
                                                <ChevronRight
                                                    size={13}
                                                    className={`inline text-slate-500 transition ${isOpen ? 'rotate-90' : ''}`}
                                                />
                                            )}
                                        </td>
                                    </tr>
                                    {isOpen && (
                                        <tr>
                                            <td colSpan={EPS_PERCENTILES.length + 3} className="px-3 py-3">
                                                {loadingSeries === row.code ? (
                                                    <p className="text-xs text-slate-500 flex items-center gap-2">
                                                        <Loader2 size={13} className="animate-spin" /> Cargando serie…
                                                    </p>
                                                ) : (
                                                    <ReservoirChart
                                                        predictions={series[row.code] ?? []}
                                                        unit={row.unit}
                                                    />
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {onlyWithData && withData.length === 0 && (
                <p className="text-[11px] text-slate-500 mt-2">Ningún embalse tiene datos en esta corrida.</p>
            )}
        </div>
    );
}

/** Every series of one reservoir on shared axes, so the ensemble spread is readable. */
function ReservoirChart({ predictions, unit }: { predictions: SimulationPrediction[]; unit: string }) {
    const chartSeries: ChartSeries[] = predictions
        .filter((prediction) => (prediction.results?.length ?? 0) > 0)
        .map((prediction, index) => ({
            label: prediction.percentile === null ? 'Harmonie' : `P${prediction.percentile}`,
            color: SERIES_COLORS[index % SERIES_COLORS.length],
            points: (prediction.results ?? []).map((point) => ({ date: point.date, value: point.value })),
        }));

    if (chartSeries.length === 0) {
        return <p className="text-xs text-slate-600">Sin serie para graficar.</p>;
    }

    return <SeriesChart series={chartSeries} unit={unit} height={200} />;
}
