import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    CheckCircle2,
    Download,
    Droplet,
    FileText,
    FolderInput,
    FolderOutput,
    Loader2,
    Radio,
    UserRound,
    X,
} from 'lucide-react';
import { downloadSimulationFile, finalizeSimulation, getManualSimulationById, listSimulationFiles } from './api';
import { formatIsoDate, formatSimDate } from '../predictions-data/format';
import type { SftpFileMeta, SimulationFileStatus, SimulationFolder } from '../predictions-data/types';
import { isDirectSource, isTerminalStatus } from './types';
import SimulationResults from './SimulationResults';
import InputSeriesChart from './InputSeriesChart';
import { statusBadgeClass, statusDescription, statusLabel } from './status';
import { useModalDismiss } from './useModalDismiss';

interface MonitorSimulationModalProps {
    simulationId: string;
    onClose: () => void;
}

const SIM_POLL_MS = 4000;
const FILES_POLL_MS = 6000;

function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes < 0) return '-';
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB'];
    let value = bytes / 1024;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }
    return `${value.toFixed(1)} ${units[unitIndex]}`;
}

interface FileListProps {
    title: string;
    icon: React.ReactNode;
    files: SftpFileMeta[];
    folder: SimulationFolder;
    downloadingName: string | null;
    onDownload: (folder: SimulationFolder, name: string) => void;
    /** Shown instead of "sin archivos" when an empty folder is the expected outcome. */
    emptyHint?: string;
}

/**
 * Tells apart a result still waiting to be picked up from one already consumed —
 * and, above all, makes a file that could not be parsed visible instead of
 * letting it look like nothing ever arrived.
 */
const FILE_STATUS_STYLES: Record<SimulationFileStatus, { label: string; className: string; title: string }> = {
    pending: {
        label: 'Pendiente',
        className: 'bg-slate-700/50 text-slate-300 border-slate-600/50',
        title: 'Todavía no lo procesó el modelo',
    },
    processed: {
        label: 'Procesado',
        className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
        title: 'Leído correctamente y archivado en historial/',
    },
    failed: {
        label: 'Con error',
        className: 'bg-red-500/10 text-red-300 border-red-500/30',
        title: 'Llegó, pero no se pudo procesar (corrupted/)',
    },
};

function FileStatusBadge({ status }: { status: SimulationFileStatus }) {
    const style = FILE_STATUS_STYLES[status] ?? FILE_STATUS_STYLES.pending;
    return (
        <span
            title={style.title}
            className={`shrink-0 px-1.5 py-0.5 rounded-md border text-[10px] font-medium ${style.className}`}
        >
            {style.label}
        </span>
    );
}

function FileList({ title, icon, files, folder, downloadingName, onDownload, emptyHint }: FileListProps) {
    return (
        <div>
            <div className="flex items-center gap-2 mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                {icon}
                <span>{title}</span>
                <span className="inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full bg-slate-700/60 text-slate-300 text-[10px] normal-case tracking-normal">
                    {files.length}
                </span>
            </div>
            {files.length === 0 ? (
                <p
                    className={`text-xs border border-dashed rounded-lg px-4 py-4 text-center ${
                        emptyHint ? 'text-slate-400 border-slate-600/60' : 'text-slate-600 border-slate-700/60'
                    }`}
                >
                    {emptyHint ?? 'Sin archivos todavía'}
                </p>
            ) : (
                <div className="border border-slate-700/50 rounded-lg overflow-hidden divide-y divide-slate-700/40">
                    {files.map((file) => {
                        const isDownloading = downloadingName === `${folder}/${file.name}`;
                        return (
                            <div key={`${file.status}/${file.name}`} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-800/40 transition">
                                <FileText size={13} className="text-slate-500 shrink-0" />
                                <span className="flex-1 truncate text-xs text-slate-200" title={file.name}>{file.name}</span>
                                <FileStatusBadge status={file.status} />
                                <span className="text-[11px] text-slate-500 tabular-nums">{formatBytes(file.size)}</span>
                                <span className="text-[11px] text-slate-600 w-32 text-right hidden sm:block">{formatIsoDate(file.modifiedAt)}</span>
                                <button
                                    onClick={() => onDownload(folder, file.name)}
                                    disabled={isDownloading}
                                    title="Descargar"
                                    className="p-1 rounded-md text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 disabled:opacity-40 transition"
                                >
                                    {isDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default function MonitorSimulationModal({ simulationId, onClose }: MonitorSimulationModalProps) {
    const queryClient = useQueryClient();
    const [downloadingName, setDownloadingName] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    useModalDismiss(onClose);

    const { data: sim, isLoading, isError } = useQuery({
        queryKey: ['manual-simulation', simulationId],
        queryFn: ({ signal }) => getManualSimulationById(simulationId, signal),
        refetchInterval: (query) => (isTerminalStatus(query.state.data?.status ?? '') ? false : SIM_POLL_MS),
    });

    const status = sim?.status ?? '';
    const terminal = isTerminalStatus(status);

    const { data: files } = useQuery({
        queryKey: ['manual-simulation-files', simulationId],
        queryFn: ({ signal }) => listSimulationFiles(simulationId, signal),
        refetchInterval: terminal ? false : FILES_POLL_MS,
    });

    const finalizeMutation = useMutation({
        mutationFn: () => finalizeSimulation(simulationId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['manual-simulation', simulationId] });
            queryClient.invalidateQueries({ queryKey: ['manual-simulations'] });
        },
        onError: () => setActionError('No se pudo finalizar la simulación'),
    });

    async function handleDownload(folder: SimulationFolder, name: string) {
        setActionError(null);
        setDownloadingName(`${folder}/${name}`);
        try {
            await downloadSimulationFile(simulationId, folder, name);
        } catch {
            setActionError(`No se pudo descargar "${name}"`);
        } finally {
            setDownloadingName(null);
        }
    }

    const canFinalize = status === 'MODEL_PROCESSING' || status === 'IN_PROGRESS';

    return (
        <div
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-overlay-in"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl ring-1 ring-white/5 animate-panel-in overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-start justify-between px-6 py-5 border-b border-slate-700/50 bg-gradient-to-br from-blue-600/15 via-slate-900 to-slate-900">
                    <div className="flex items-center gap-3.5">
                        <div className={`p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-600/30 ${terminal ? '' : 'animate-pulse'}`}>
                            <Radio className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-slate-50">Monitoreo de simulación</h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {sim ? formatSimDate(sim.simulationDate) : simulationId}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-auto subtle-scroll px-6 py-5 space-y-5">
                    {isLoading ? (
                        <p className="text-center text-slate-500 py-10 flex items-center justify-center gap-2">
                            <Loader2 size={16} className="animate-spin" /> Cargando simulación...
                        </p>
                    ) : isError || !sim ? (
                        <p className="text-center text-red-400 py-10">Error al cargar la simulación</p>
                    ) : (
                        <>
                            {/* Status hero */}
                            <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 px-4 py-3.5 flex items-center justify-between gap-4 flex-wrap">
                                <div className="flex items-center gap-3">
                                    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${statusBadgeClass(status)}`}>
                                        {!terminal && <Loader2 size={13} className="animate-spin" />}
                                        {statusLabel(status)}
                                    </span>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-slate-300">{statusDescription(status)}</span>
                                        {!terminal && <span className="text-[10px] text-amber-400/80">● actualizando en vivo</span>}
                                    </div>
                                </div>
                                {canFinalize && (
                                    <button
                                        onClick={() => {
                                            setActionError(null);
                                            finalizeMutation.mutate();
                                        }}
                                        disabled={finalizeMutation.isPending}
                                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition"
                                    >
                                        {finalizeMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                        Finalizar
                                    </button>
                                )}
                            </div>

                            {/* Meta */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-lg border border-slate-700/40 bg-slate-800/30 px-3.5 py-2.5">
                                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                                        <Droplet size={11} /> Meteo
                                    </div>
                                    <div className="text-sm text-slate-200 flex items-center gap-2">
                                        {sim.modmeteo ?? '-'}
                                        {sim.modelSource === 'MOCK' && (
                                            <span
                                                title="Flujo directo contra un FEWS simulado — resultado de referencia"
                                                className="px-1.5 py-0.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-300 text-[10px] font-medium"
                                            >
                                                Mock
                                            </span>
                                        )}
                                        {sim.modelSource === 'FEWS_API' && (
                                            <span
                                                title="Lanzada directamente en FEWS por la API"
                                                className="px-1.5 py-0.5 rounded-md border border-sky-500/30 bg-sky-500/10 text-sky-300 text-[10px] font-medium"
                                            >
                                                FEWS
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="rounded-lg border border-slate-700/40 bg-slate-800/30 px-3.5 py-2.5">
                                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                                        <UserRound size={11} /> Operador
                                    </div>
                                    <div className="text-sm text-slate-200 truncate" title={sim.createdBy ?? ''}>{sim.createdBy ?? '-'}</div>
                                </div>
                            </div>

                            {sim.description && (
                                <p className="text-xs text-slate-300 bg-slate-800/40 border border-slate-700/40 rounded-lg px-4 py-2.5">
                                    {sim.description}
                                </p>
                            )}

                            {actionError && (
                                <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2.5">
                                    {actionError}
                                </p>
                            )}

                            {/* Maneuvers */}
                            <div>
                                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400 mb-2">
                                    Maniobras
                                    <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full bg-slate-700/60 text-slate-300 text-[10px] normal-case tracking-normal">
                                        {sim.maneuvers.length}
                                    </span>
                                </div>
                                <div className="border border-slate-700/50 rounded-lg overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-slate-800/60 text-slate-400">
                                                <th className="text-left font-medium px-3.5 py-2">Embalse</th>
                                                <th className="text-right font-medium px-3.5 py-2">Caudal m³/s</th>
                                                <th className="text-left font-medium px-3.5 py-2">Inicio</th>
                                                <th className="text-left font-medium px-3.5 py-2">Fin</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700/40">
                                            {sim.maneuvers.map((m) => (
                                                <tr key={m.id} className="hover:bg-slate-800/30 transition">
                                                    <td className="px-3.5 py-2 text-slate-200 font-medium">{m.reservoirCode}</td>
                                                    <td className="px-3.5 py-2 text-right text-slate-300 tabular-nums">{m.outputFlowValue}</td>
                                                    <td className="px-3.5 py-2 text-slate-500">{formatIsoDate(m.startDate)}</td>
                                                    <td className="px-3.5 py-2 text-slate-500">{formatIsoDate(m.endDate)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* What went in, drawn from the file the model received */}
                            <InputSeriesChart
                                simulationId={sim.id}
                                fileName={files?.input?.[0]?.name ?? null}
                            />

                            {/* What came out: the balance, which is the real output */}
                            <SimulationResults simulationId={sim.id} />

                            {/* SFTP files */}
                            <div className="space-y-4">
                                <FileList
                                    title={
                                        isDirectSource(sim.modelSource)
                                            ? 'Input · enviado al modelo por API'
                                            : 'Input · enviado al modelo'
                                    }
                                    icon={<FolderInput size={13} className="text-emerald-400" />}
                                    files={files?.input ?? []}
                                    folder="input"
                                    downloadingName={downloadingName}
                                    onDownload={handleDownload}
                                />
                                <FileList
                                    title="Output · respuesta del modelo"
                                    icon={<FolderOutput size={13} className="text-amber-400" />}
                                    files={files?.output ?? []}
                                    folder="output"
                                    downloadingName={downloadingName}
                                    onDownload={handleDownload}
                                    // In the direct flow the answer arrives over the PI REST API and is
                                    // archived here afterwards, so an empty folder no longer means "the
                                    // model did not reply" — it means the copy could not be written.
                                    emptyHint={
                                        isDirectSource(sim.modelSource)
                                            ? 'El modelo respondió por la API y la respuesta se archiva acá. Si está vacío, no se pudo guardar la copia: los resultados igual se procesaron.'
                                            : undefined
                                    }
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
