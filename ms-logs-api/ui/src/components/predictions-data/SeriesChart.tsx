// Dependency-free SVG line chart for a prediction series.
// Kept intentionally small: one or more series sharing the same time/value axes.

export interface ChartSeries {
    label: string;
    color: string;
    points: { date: string; value: number }[];
}

interface SeriesChartProps {
    series: ChartSeries[];
    unit?: string;
    height?: number;
}

const VIEW_W = 600;
const PAD_X = 8;
const PAD_Y = 10;

interface Scaled {
    x: number;
    y: number;
}

export default function SeriesChart({ series, unit = '', height = 180 }: SeriesChartProps) {
    const allPoints = series.flatMap((s) =>
        s.points.map((p) => ({ t: Date.parse(p.date), v: p.value })).filter((p) => Number.isFinite(p.t)),
    );

    if (allPoints.length === 0) return null;

    const innerW = VIEW_W - PAD_X * 2;
    const innerH = height - PAD_Y * 2;

    const times = allPoints.map((p) => p.t);
    const values = allPoints.map((p) => p.v);
    const tMin = Math.min(...times);
    const tMax = Math.max(...times);
    const vMin = Math.min(...values);
    const vMax = Math.max(...values);
    const tSpan = tMax - tMin || 1;
    const vSpan = vMax - vMin || 1;

    const scale = (date: string, value: number): Scaled | null => {
        const t = Date.parse(date);
        if (!Number.isFinite(t)) return null;
        const x = PAD_X + ((t - tMin) / tSpan) * innerW;
        const y = PAD_Y + (1 - (value - vMin) / vSpan) * innerH;
        return { x, y };
    };

    return (
        <div className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1 text-xs text-slate-500">
                <span>
                    max {vMax} {unit}
                </span>
                {series.length > 1 && (
                    <div className="flex gap-3">
                        {series.map((s) => (
                            <span key={s.label} className="flex items-center gap-1">
                                <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
                                {s.label}
                            </span>
                        ))}
                    </div>
                )}
            </div>
            <svg
                viewBox={`0 0 ${VIEW_W} ${height}`}
                width="100%"
                height={height}
                preserveAspectRatio="none"
                role="img"
                aria-label="Serie de prediccion"
            >
                {/* baseline */}
                <line
                    x1={PAD_X}
                    y1={height - PAD_Y}
                    x2={VIEW_W - PAD_X}
                    y2={height - PAD_Y}
                    stroke="#334155"
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                />
                {series.map((s) => {
                    const scaled = s.points
                        .map((p) => scale(p.date, p.value))
                        .filter((p): p is Scaled => p !== null);
                    if (scaled.length === 0) return null;
                    if (scaled.length === 1) {
                        return <circle key={s.label} cx={scaled[0].x} cy={scaled[0].y} r={3} fill={s.color} />;
                    }
                    const path = scaled.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
                    return (
                        <polyline
                            key={s.label}
                            points={path}
                            fill="none"
                            stroke={s.color}
                            strokeWidth={1.5}
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                        />
                    );
                })}
            </svg>
            <div className="flex justify-between mt-1 text-[11px] text-slate-600">
                <span>min {vMin} {unit}</span>
            </div>
        </div>
    );
}
