import type { AerialEventPoint, AerialSeries } from '../../types/aerial-precipitation';

interface Props {
    rows: AerialSeries[];
}

function fmtDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
}

function fmtEventPoint(p: AerialEventPoint | null): string {
    if (!p) return '—';
    return `${p.value.toFixed(2)} mm @ ${fmtDate(p.eventDate)}`;
}

export default function SeriesTable({ rows }: Props) {
    return (
        <div className="overflow-x-auto rounded-lg border border-slate-700/50">
            <table className="min-w-full divide-y divide-slate-700 text-sm">
                <thead className="bg-slate-800/70">
                    <tr>
                        <Th>Location</Th>
                        <Th>Station</Th>
                        <Th>Provider</Th>
                        <Th>Layer</Th>
                        <Th>Accum</Th>
                        <Th>Stat</Th>
                        <Th>Forecast</Th>
                        <Th>Max</Th>
                        <Th>Last</Th>
                        <Th>Source</Th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                    {rows.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-800/60">
                            <Td className="font-mono text-xs text-sky-300">{r.locationId}</Td>
                            <Td>{r.stationName ?? '—'}</Td>
                            <Td className="uppercase text-xs">{r.provider}</Td>
                            <Td className="text-xs">{r.layer}</Td>
                            <Td>{r.accumulation}</Td>
                            <Td>{r.stat ?? '—'}</Td>
                            <Td className="text-xs">{fmtDate(r.forecastDate)}</Td>
                            <Td className="text-xs">{fmtEventPoint(r.max)}</Td>
                            <Td className="text-xs">{fmtEventPoint(r.last)}</Td>
                            <Td className="text-xs text-slate-500 truncate max-w-[16rem]">
                                {r.sourceFileName}
                            </Td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function Th({ children }: { children: React.ReactNode }) {
    return (
        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
            {children}
        </th>
    );
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <td className={`px-3 py-2 text-slate-200 ${className}`}>{children}</td>;
}
