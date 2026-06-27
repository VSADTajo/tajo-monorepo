import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, FlaskConical, Loader2, Plus, Rocket, Trash2, X } from 'lucide-react';
import SearchableSelect from '../hydro/SearchableSelect';
import { createManualSimulation, listReservoirs } from './api';
import { MODMETEO_OPTIONS, type ManeuverDraft, type ManeuverInput, type ManualSimulation, type ModmeteoChoice } from './types';

interface CreateSimulationModalProps {
    onClose: () => void;
    onCreated: (simulation: ManualSimulation) => void;
}

function emptyManeuver(): ManeuverDraft {
    return { reservoirCode: '', outputFlowValue: '', startDate: '', endDate: '' };
}

/** 'YYYY-MM-DDTHH:mm' (datetime-local) → ISO 8601. Empty → undefined. */
function toIso(local: string): string | undefined {
    if (!local) return undefined;
    const date = new Date(local);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function getApiErrorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'response' in error) {
        const data = (error as { response?: { data?: unknown } }).response?.data as
            | { ErrorDescription?: string; message?: string }
            | undefined;
        if (data?.ErrorDescription) return data.ErrorDescription;
        if (data?.message) return data.message;
    }
    if (error instanceof Error) return error.message;
    return 'No se pudo crear la simulación';
}

export default function CreateSimulationModal({ onClose, onCreated }: CreateSimulationModalProps) {
    const queryClient = useQueryClient();
    const [description, setDescription] = useState('');
    const [modmeteo, setModmeteo] = useState<ModmeteoChoice>('BOTH');
    const [maneuvers, setManeuvers] = useState<ManeuverDraft[]>([emptyManeuver()]);
    const [validationError, setValidationError] = useState<string | null>(null);

    const { data: reservoirs = [], isLoading: loadingReservoirs } = useQuery({
        queryKey: ['reservoirs'],
        queryFn: () => listReservoirs(),
        staleTime: 5 * 60 * 1000,
    });

    const reservoirOptions = useMemo(
        () => reservoirs.map((r) => ({ value: r.code, label: `${r.name} (${r.code})` })),
        [reservoirs],
    );

    const mutation = useMutation({
        mutationFn: createManualSimulation,
        onSuccess: (simulation) => {
            queryClient.invalidateQueries({ queryKey: ['manual-simulations'] });
            onCreated(simulation);
        },
    });

    function updateManeuver(index: number, patch: Partial<ManeuverDraft>) {
        setManeuvers((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
    }

    function addManeuver() {
        setManeuvers((prev) => [...prev, emptyManeuver()]);
    }

    function removeManeuver(index: number) {
        setManeuvers((prev) => prev.filter((_, i) => i !== index));
    }

    /** Validates the form and returns the payload maneuvers, or null on error (sets validationError). */
    function buildManeuvers(): ManeuverInput[] | null {
        if (maneuvers.length === 0) {
            setValidationError('Agregá al menos una maniobra.');
            return null;
        }
        const result: ManeuverInput[] = [];
        for (let i = 0; i < maneuvers.length; i += 1) {
            const m = maneuvers[i];
            const label = `Maniobra ${i + 1}`;
            if (!m.reservoirCode) {
                setValidationError(`${label}: seleccioná un embalse.`);
                return null;
            }
            const flow = Number(m.outputFlowValue);
            if (m.outputFlowValue === '' || !Number.isFinite(flow)) {
                setValidationError(`${label}: el caudal es obligatorio y debe ser un número válido.`);
                return null;
            }
            if (flow < 0) {
                setValidationError(`${label}: el caudal no puede ser negativo.`);
                return null;
            }
            const startIso = toIso(m.startDate);
            const endIso = toIso(m.endDate);
            if (startIso && endIso && new Date(endIso) < new Date(startIso)) {
                setValidationError(`${label}: la fecha de fin no puede ser anterior a la de inicio.`);
                return null;
            }
            result.push({
                reservoirCode: m.reservoirCode,
                outputFlowValue: flow,
                ...(startIso ? { startDate: startIso } : {}),
                ...(endIso ? { endDate: endIso } : {}),
            });
        }
        return result;
    }

    function handleSubmit() {
        setValidationError(null);
        const built = buildManeuvers();
        if (!built) return;
        mutation.mutate({
            ...(description.trim() ? { description: description.trim() } : {}),
            modmeteo,
            maneuvers: built,
        });
    }

    const submitting = mutation.isPending;
    const errorMessage = validationError ?? (mutation.isError ? getApiErrorMessage(mutation.error) : null);
    const inputClass =
        'w-full bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/20 transition';

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-overlay-in">
            <div className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl ring-1 ring-white/5 animate-panel-in overflow-hidden">
                {/* Header */}
                <div className="relative flex items-start justify-between px-6 py-5 border-b border-slate-700/50 bg-gradient-to-br from-blue-600/15 via-slate-900 to-slate-900">
                    <div className="flex items-center gap-3.5">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-600/30">
                            <FlaskConical className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-slate-50">Nueva simulación manual</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Cargá las maniobras y despachá la simulación al modelo</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={submitting}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 disabled:opacity-40 transition"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-auto subtle-scroll px-6 py-5 space-y-6">
                    {/* Description + modmeteo */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-400 mb-1.5">
                                Descripción <span className="text-slate-600 normal-case tracking-normal">· opcional</span>
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                maxLength={500}
                                rows={2}
                                placeholder="Operación de control Tranco..."
                                className={`${inputClass} resize-none`}
                            />
                            <p className="text-[10px] text-slate-600 mt-1 text-right">{description.length}/500</p>
                        </div>
                        <div>
                            <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-400 mb-1.5">
                                Forzamiento meteorológico
                            </label>
                            <select
                                value={modmeteo}
                                onChange={(e) => setModmeteo(e.target.value as ModmeteoChoice)}
                                className={inputClass}
                            >
                                {MODMETEO_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Maneuvers */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                                Maniobras
                                <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-blue-500/15 text-blue-300 text-[10px] font-semibold normal-case tracking-normal">
                                    {maneuvers.length}
                                </span>
                            </label>
                            <button
                                onClick={addManeuver}
                                className="flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 px-2.5 py-1 rounded-lg transition"
                            >
                                <Plus size={13} /> Agregar
                            </button>
                        </div>

                        {loadingReservoirs && (
                            <p className="text-xs text-slate-500 mb-2 flex items-center gap-1.5">
                                <Loader2 size={12} className="animate-spin" /> Cargando embalses...
                            </p>
                        )}

                        <div className="space-y-2.5">
                            {maneuvers.map((m, index) => (
                                <div
                                    key={index}
                                    className="rounded-xl border border-slate-700/50 bg-slate-800/40 hover:border-slate-600/60 transition p-3.5"
                                >
                                    <div className="flex items-center justify-between mb-2.5">
                                        <span className="flex items-center gap-2 text-[11px] font-semibold text-slate-300">
                                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-slate-700 text-slate-300 text-[10px]">
                                                {index + 1}
                                            </span>
                                            Maniobra
                                        </span>
                                        <button
                                            onClick={() => removeManeuver(index)}
                                            disabled={maneuvers.length === 1}
                                            title={maneuvers.length === 1 ? 'Debe haber al menos una maniobra' : 'Quitar maniobra'}
                                            className="p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500 transition"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-[1.4fr_0.8fr_1fr_1fr] gap-2.5">
                                        <div>
                                            <label className="block text-[10px] text-slate-500 mb-1">Embalse</label>
                                            <SearchableSelect
                                                options={reservoirOptions}
                                                value={m.reservoirCode}
                                                onChange={(val) => updateManeuver(index, { reservoirCode: val })}
                                                placeholder="Seleccionar"
                                                className="w-full"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-slate-500 mb-1">Caudal m³/s</label>
                                            <input
                                                type="number"
                                                min={0}
                                                step="any"
                                                value={m.outputFlowValue}
                                                onChange={(e) => updateManeuver(index, { outputFlowValue: e.target.value })}
                                                placeholder="12.5"
                                                className={inputClass}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-slate-500 mb-1">Inicio · opcional</label>
                                            <input
                                                type="datetime-local"
                                                value={m.startDate}
                                                onChange={(e) => updateManeuver(index, { startDate: e.target.value })}
                                                className={`${inputClass} text-slate-300`}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-slate-500 mb-1">Fin · opcional</label>
                                            <input
                                                type="datetime-local"
                                                value={m.endDate}
                                                onChange={(e) => updateManeuver(index, { endDate: e.target.value })}
                                                className={`${inputClass} text-slate-300`}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {errorMessage && (
                        <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2.5 flex items-center gap-2">
                            <AlertCircle size={14} className="shrink-0" />
                            {errorMessage}
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700/50 bg-slate-900/80">
                    <button
                        onClick={onClose}
                        disabled={submitting}
                        className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-700/50 disabled:opacity-40 transition"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-600/25 disabled:opacity-50 disabled:shadow-none transition"
                    >
                        {submitting ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
                        {submitting ? 'Despachando...' : 'Despachar simulación'}
                    </button>
                </div>
            </div>
        </div>
    );
}
