import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Trash2 } from 'lucide-react';
import { deleteSimulation } from './api';
import { formatSimDate } from '../predictions-data/format';
import type { ManualSimulationListItem } from './types';
import { useModalDismiss } from './useModalDismiss';

interface ConfirmDeleteDialogProps {
    simulation: ManualSimulationListItem;
    onClose: () => void;
}

export default function ConfirmDeleteDialog({ simulation, onClose }: ConfirmDeleteDialogProps) {
    const queryClient = useQueryClient();
    useModalDismiss(onClose);

    const deleteMutation = useMutation({
        mutationFn: () => deleteSimulation(simulation.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['manual-simulations'] });
            onClose();
        },
    });

    return (
        <div
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-overlay-in"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-md shadow-2xl ring-1 ring-white/5 animate-panel-in overflow-hidden"
            >
                <div className="px-5 py-4 border-b border-slate-700/50">
                    <h3 className="text-sm font-semibold text-slate-100">Borrar simulación</h3>
                </div>
                <div className="px-5 py-4 text-xs text-slate-300 space-y-2">
                    <p>
                        ¿Seguro que querés borrar la simulación del{' '}
                        <span className="text-slate-100">{formatSimDate(simulation.simulationDate)}</span>?
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
                        onClick={onClose}
                        disabled={deleteMutation.isPending}
                        className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-700/50 disabled:opacity-40"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => deleteMutation.mutate()}
                        disabled={deleteMutation.isPending}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-500 disabled:opacity-50"
                    >
                        {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        Borrar
                    </button>
                </div>
            </div>
        </div>
    );
}
