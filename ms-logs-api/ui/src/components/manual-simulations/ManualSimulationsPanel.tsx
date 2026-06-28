import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, FlaskConical, Loader2, Plus, Radio, Trash2 } from 'lucide-react';
import { deleteSimulation, listManualSimulations } from './api';
import { formatIsoDate, formatSimDate } from '../predictions-data/format';
import { isTerminalStatus, type ManualSimulationListItem } from './types';
import { statusBadgeClass } from './status';
import CreateSimulationModal from './CreateSimulationModal';
import MonitorSimulationModal from './MonitorSimulationModal';

const PAGE_SIZE = 20;
const LIST_POLL_MS = 8000;

const STATUS_OPTIONS = ['', 'CREATED', 'MODEL_PROCESSING', 'IN_PROGRESS', 'FINALIZED', 'MODEL_FAILED'];

export default function ManualSimulationsPanel() {
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [showCreate, setShowCreate] = useState(false);
    const [monitorId, setMonitorId] = useState<string | null>(null);
    const [pendingDelete, setPendingDelete] = useState<ManualSimulationListItem | null>(null);

    const { data, isLoading, isError, isFetching } = useQuery({
        queryKey: ['manual-simulations', statusFilter, page],
        queryFn: ({ signal }) =>
            listManualSimulations(
                { status: statusFilter || undefined, page, limit: PAGE_SIZE, sortBy: 'createdAt', sortOrder: 'DESC' },
                signal,
            ),
        // Keep the list fresh while any simulation is still running.
        refetchInterval: (query) => {
            const rows = query.state.data?.data ?? [];
            return rows.some((r) => !isTerminalStatus(r.status)) ? LIST_POLL_MS : false;
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => deleteSimulation(id),
        onSuccess: () => {
            setPendingDelete(null);
            queryClient.invalidateQueries({ queryKey: ['manual-simulations'] });
        },
    });

    const rows = data?.data ?? [];
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="border-b border-slate-700/50 bg-gradient-to-r from-blue-600/10 via-slate-900 to-slate-900 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-600/25">
                        <FlaskConical className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-slate-50">Simulaciones manuales</h1>
                        <p className="text-xs text-slate-400 mt-0.5">Despachá y monitoreá simulaciones manuales del modelo</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-600/25 transition"
                >
                    <Plus size={15} /> Nueva simulación
                </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
                {/* Filters */}
                <div className="flex items-center gap-3 mb-4">
                    <select
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setPage(1);
                        }}
                        className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                    >
                        {STATUS_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                                {opt === '' ? 'Todos los estados' : opt}
                            </option>
                        ))}
                    </select>
                    {isFetching && <span className="text-xs text-slate-500 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> actualizando...</span>}
                </div>

                {/* Body */}
                {isLoading ? (
                    <p className="text-center text-slate-500 py-12">Cargando simulaciones...</p>
                ) : isError ? (
                    <p className="text-center text-red-400 py-12">Error al cargar las simulaciones manuales</p>
                ) : rows.length === 0 ? (
                    <p className="text-center text-slate-600 py-12">
                        No hay simulaciones manuales. Creá una con &quot;Nueva simulación&quot;.
                    </p>
                ) : (
                    <>
                        <div className="border border-slate-700/50 rounded-lg overflow-hidden">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-slate-800/60 text-slate-400">
                                        <th className="text-left font-medium px-4 py-2.5">Fecha</th>
                                        <th className="text-left font-medium px-4 py-2.5">Estado</th>
                                        <th className="text-right font-medium px-4 py-2.5">Maniobras</th>
                                        <th className="text-left font-medium px-4 py-2.5">Descripción</th>
                                        <th className="text-left font-medium px-4 py-2.5">Creada</th>
                                        <th className="px-4 py-2.5 w-40"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((sim) => (
                                        <tr
                                            key={sim.id}
                                            onClick={() => setMonitorId(sim.id)}
                                            className="border-t border-slate-700/50 hover:bg-slate-800/40 cursor-pointer"
                                        >
                                            <td className="px-4 py-2.5 text-slate-200">{formatSimDate(sim.simulationDate)}</td>
                                            <td className="px-4 py-2.5">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] ${statusBadgeClass(sim.status)}`}>
                                                    {!isTerminalStatus(sim.status) && <Loader2 size={10} className="animate-spin" />}
                                                    {sim.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 text-right text-slate-300">{sim.maneuverCount}</td>
                                            <td className="px-4 py-2.5 text-slate-400 max-w-[220px]">
                                                <span className="truncate block" title={sim.description ?? ''}>{sim.description ?? '-'}</span>
                                            </td>
                                            <td className="px-4 py-2.5 text-slate-500">{formatIsoDate(sim.createdAt ?? null)}</td>
                                            <td className="px-4 py-2.5 text-right">
                                                <div className="flex items-center justify-end gap-3">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setMonitorId(sim.id);
                                                        }}
                                                        className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
                                                        title="Monitorear"
                                                    >
                                                        <Radio size={13} /> Monitorear
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setPendingDelete(sim);
                                                        }}
                                                        className="text-red-400 hover:text-red-300"
                                                        title="Borrar"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-between mt-3 text-xs text-slate-400">
                            <span>{total} simulación{total === 1 ? '' : 'es'}</span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page <= 1}
                                    className="p-1.5 rounded-md border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 disabled:opacity-40 disabled:hover:bg-transparent"
                                >
                                    <ChevronLeft size={14} />
                                </button>
                                <span>Página {page} de {totalPages}</span>
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

            {/* Modals */}
            {showCreate && (
                <CreateSimulationModal
                    onClose={() => setShowCreate(false)}
                    onCreated={(simulation) => {
                        setShowCreate(false);
                        setMonitorId(simulation.id);
                    }}
                />
            )}

            {monitorId && <MonitorSimulationModal simulationId={monitorId} onClose={() => setMonitorId(null)} />}

            {pendingDelete && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-overlay-in">
                    <div className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-md shadow-2xl ring-1 ring-white/5 animate-panel-in overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-700/50">
                            <h3 className="text-sm font-semibold text-slate-100">Borrar simulación</h3>
                        </div>
                        <div className="px-5 py-4 text-xs text-slate-300 space-y-2">
                            <p>
                                ¿Seguro que querés borrar la simulación del{' '}
                                <span className="text-slate-100">{formatSimDate(pendingDelete.simulationDate)}</span>?
                            </p>
                            <p className="text-slate-500">
                                Se borrarán también sus maniobras exclusivas. Esta acción no se puede deshacer.
                            </p>
                            {deleteMutation.isError && (
                                <p className="text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                                    No se pudo borrar la simulación
                                </p>
                            )}
                        </div>
                        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-700/50">
                            <button
                                onClick={() => setPendingDelete(null)}
                                disabled={deleteMutation.isPending}
                                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-700/50 disabled:opacity-40"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => deleteMutation.mutate(pendingDelete.id)}
                                disabled={deleteMutation.isPending}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-500 disabled:opacity-50"
                            >
                                {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                Borrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
