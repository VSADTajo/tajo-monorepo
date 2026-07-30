import { useEffect, useMemo, useState } from 'react';
import { Loader2, LineChart } from 'lucide-react';

import SeriesChart, { type ChartSeries } from '../predictions-data/SeriesChart';
import { fetchSimulationInputSeries } from './api';
import type { InputSeries } from './types';

/**
 * Charts what was actually sent to the model, read from the generated input file.
 *
 * Not from the stored maneuver on purpose: the maneuver only keeps
 * `outputFlowValue`, so a pasted curve exists nowhere but in this file. Reading the
 * file is therefore the only honest answer to "did it send what I typed?" — and it
 * is the same bytes the model received, not a reconstruction.
 *
 * A flat maneuver draws as a straight line over the whole horizon and a curve draws
 * as its shape, so the difference between the two modes is visible at a glance.
 */

const SERIES_COLORS = ['#34d399', '#38bdf8', '#fbbf24', '#a78bfa', '#f472b6', '#60a5fa'];

interface InputSeriesChartProps {
    simulationId: string;
    /** Name of the generated input file, taken from the file listing. */
    fileName: string | null;
}

export default function InputSeriesChart({ simulationId, fileName }: InputSeriesChartProps) {
    const [series, setSeries] = useState<InputSeries[] | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (!fileName) return;

        const controller = new AbortController();
        setSeries(null);
        setFailed(false);

        fetchSimulationInputSeries(simulationId, fileName, controller.signal)
            .then(setSeries)
            .catch(() => {
                if (!controller.signal.aborted) setFailed(true);
            });

        return () => controller.abort();
    }, [simulationId, fileName]);

    const chartSeries: ChartSeries[] = useMemo(
        () =>
            (series ?? [])
                .filter((entry) => entry.points.length > 0)
                .map((entry, index) => ({
                    label: entry.reservoirCode,
                    color: SERIES_COLORS[index % SERIES_COLORS.length],
                    points: entry.points,
                })),
        [series],
    );

    if (!fileName) return null;

    return (
        <div>
            <div className="flex items-center gap-2 mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                <LineChart size={13} className="text-emerald-400" />
                <span>Caudal de salida enviado al modelo</span>
            </div>

            {failed ? (
                <p className="text-xs text-slate-600 border border-dashed border-slate-700/60 rounded-lg px-4 py-3 text-center">
                    No se pudo leer el archivo de input para graficarlo.
                </p>
            ) : series === null ? (
                <p className="text-xs text-slate-500 flex items-center gap-2 px-1 py-2">
                    <Loader2 size={13} className="animate-spin" /> Leyendo el input…
                </p>
            ) : chartSeries.length === 0 ? (
                <p className="text-xs text-slate-600">El input no trae puntos con valor.</p>
            ) : (
                <SeriesChart series={chartSeries} unit={series[0]?.unit ?? 'm³/s'} height={170} />
            )}
        </div>
    );
}
