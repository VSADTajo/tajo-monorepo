import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, LineChart, Search } from 'lucide-react';
import SearchableSelect from '../hydro/SearchableSelect';
import { listStations } from '../hydro/api';
import { listSimulations } from './api';
import { formatSimDate } from './format';
import SimulationSeriesModal from './SimulationSeriesModal';
import type { DataOrigin, SimulationItem } from './types';

const PAGE_SIZE = 20;

const ORIGIN_OPTIONS: { value: '' | DataOrigin; label: string }[] = [
    { value: '', label: 'Todos los origenes' },
    { value: 'FORECAST', label: 'Forecast' },
    { value: 'HISTORICAL', label: 'Historical' },
];

function statusBadgeClass(status: string): string {
    const normalized = status.toUpperCase();
    if (normalized.includes('FINAL') || normalized.includes('COMPLET') || normalized.includes('SUCCESS'))
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    if (normalized.includes('FAIL') || normalized.includes('ERROR'))
        return 'bg-red-500/15 text-red-300 border-red-500/30';
    if (normalized.includes('PEND') || normalized.includes('PROCESS') || normalized.includes('RUN'))
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    return 'bg-slate-600/20 text-slate-300 border-slate-600/40';
}

export default function PredictionsDataPanel() {
    const [stationCode, setStationCode] = useState('');
    const [dataOrigin, setDataOrigin] = useState<'' | DataOrigin>('FORECAST');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [selectedSim, setSelectedSim] = useState<SimulationItem | null>(null);

    // Station selector — reuse the hydro stations endpoint (gateway → ms-hydro-api).
    const { data: stationsData } = useQuery({
        queryKey: ['stations'],
        queryFn: () => listStations(),
        staleTime: 5 * 60 * 1000,
    });
    const stations = stationsData?.items ?? [];
    const stationOptions = stations.map((st) => ({ value: st.stationCode, label: `${st.name} (${st.stationCode})` }));
    const selectedStationName = stations.find((st) => st.stationCode === stationCode)?.name ?? stationCode;

    // Simulations for the selected station.
    const { data, isLoading, isError, isFetching } = useQuery({
        queryKey: ['simulations', stationCode, dataOrigin, page],
        queryFn: ({ signal }) =>
            listSimulations(
                {
                    stationCode,
                    dataOrigin: dataOrigin || undefined,
                    page,
                    limit: PAGE_SIZE,
                    sortBy: 'simulationDate',
                    sortOrder: 'DESC',
                },
                signal,
            ),
        enabled: !!stationCode,
        staleTime: 60 * 1000,
    });

    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    // Client-side quick filter over the loaded page (date or status text).
    const rows = useMemo(() => {
        const items = data?.data ?? [];
        if (!search) return items;
        const needle = search.toLowerCase();
        return items.filter(
            (sim) =>
                sim.simulationDate.toLowerCase().includes(needle) ||
                sim.status.toLowerCase().includes(needle),
        );
    }, [data, search]);

    function selectStation(code: string) {
        setStationCode(code);
        setPage(1);
    }

    function selectOrigin(value: string) {
        setDataOrigin(value as '' | DataOrigin);
        setPage(1);
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="border-b border-slate-700/50 bg-slate-900 px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30">
                        <LineChart className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-slate-100">Predicciones</h1>
                        <p className="text-xs text-slate-400">Series de simulaciones por estacion y tipo de prediccion</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
                {/* Filters */}
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                    <SearchableSelect
                        options={stationOptions}
                        value={stationCode}
                        onChange={selectStation}
                        placeholder="Seleccionar estacion"
                        className="w-64"
                    />
                    <select
                        value={dataOrigin}
                        onChange={(e) => selectOrigin(e.target.value)}
                        className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                    >
                        {ORIGIN_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    <div className="relative max-w-[200px] ml-auto">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            disabled={!stationCode}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                            placeholder="Filtrar fecha / estado..."
                        />
                    </div>
                </div>

                {/* Body */}
                {!stationCode ? (
                    <p className="text-center text-slate-600 py-12">Selecciona una estacion para ver sus simulaciones</p>
                ) : isLoading ? (
                    <p className="text-center text-slate-500 py-12">Cargando simulaciones...</p>
                ) : isError ? (
                    <p className="text-center text-red-400 py-12">Error al cargar las simulaciones</p>
                ) : rows.length === 0 ? (
                    <p className="text-center text-slate-600 py-12">
                        {search ? 'Ninguna simulacion coincide con el filtro' : 'No hay simulaciones para esta estacion'}
                    </p>
                ) : (
                    <>
                        <div className="border border-slate-700/50 rounded-lg overflow-hidden">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-slate-800/60 text-slate-400">
                                        <th className="text-left font-medium px-4 py-2.5">Fecha simulacion</th>
                                        <th className="text-left font-medium px-4 py-2.5">Estado</th>
                                        <th className="text-left font-medium px-4 py-2.5">Origen</th>
                                        <th className="text-left font-medium px-4 py-2.5">Tipo</th>
                                        <th className="text-left font-medium px-4 py-2.5">Meteo</th>
                                        <th className="px-4 py-2.5 w-24"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((sim) => {
                                        const canViewSeries = sim.dataOrigin !== 'HISTORICAL';
                                        return (
                                            <tr
                                                key={sim.id}
                                                onClick={canViewSeries ? () => setSelectedSim(sim) : undefined}
                                                className={`border-t border-slate-700/50 ${
                                                    canViewSeries ? 'hover:bg-slate-800/40 cursor-pointer' : 'opacity-60'
                                                }`}
                                            >
                                                <td className="px-4 py-2.5 text-slate-200">{formatSimDate(sim.simulationDate)}</td>
                                                <td className="px-4 py-2.5">
                                                    <span className={`inline-block px-2 py-0.5 rounded border text-[11px] ${statusBadgeClass(sim.status)}`}>
                                                        {sim.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-slate-400">{sim.dataOrigin ?? '-'}</td>
                                                <td className="px-4 py-2.5 text-slate-400">{sim.type}</td>
                                                <td className="px-4 py-2.5 text-slate-400">{sim.modmeteo ?? '-'}</td>
                                                <td className="px-4 py-2.5 text-right">
                                                    {canViewSeries ? (
                                                        <span className="text-indigo-400 hover:text-indigo-300">Ver serie</span>
                                                    ) : (
                                                        <span className="text-slate-600" title="Las series historicas se consultan por rango de fecha">
                                                            serie por rango
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-between mt-3 text-xs text-slate-400">
                            <span>
                                {total} simulacion{total === 1 ? '' : 'es'}
                                {isFetching && <span className="ml-2 text-slate-500">actualizando...</span>}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page <= 1}
                                    className="p-1.5 rounded-md border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 disabled:opacity-40 disabled:hover:bg-transparent"
                                >
                                    <ChevronLeft size={14} />
                                </button>
                                <span>
                                    Pagina {page} de {totalPages}
                                </span>
                                <button
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages}
                                    className="p-1.5 rounded-md border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 disabled:opacity-40 disabled:hover:bg-transparent"
                                >
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {selectedSim && (
                <SimulationSeriesModal
                    stationCode={stationCode}
                    stationName={selectedStationName}
                    simulation={selectedSim}
                    onClose={() => setSelectedSim(null)}
                />
            )}
        </div>
    );
}
