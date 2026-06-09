import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AlertExecution, AlertRule } from '../../types/alert.types';
import { getAlertHistory } from '../../api/alerts';

interface AlertHistoryModalProps {
    rule: AlertRule;
    onClose: () => void;
}

export function AlertHistoryModal({ rule, onClose }: AlertHistoryModalProps) {
    const [executions, setExecutions] = useState<AlertExecution[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        getAlertHistory(rule._id, 50, 0)
            .then((data) => {
                setExecutions(data.executions);
                setTotal(data.total);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [rule._id]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-slate-700">
                    <div>
                        <h3 className="text-lg font-semibold text-white">Historial: {rule.name}</h3>
                        <p className="text-sm text-slate-400">{total} ejecuciones registradas</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="overflow-auto flex-1 p-4">
                    {loading ? (
                        <div className="text-center py-8 text-slate-400">Cargando...</div>
                    ) : executions.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">Sin ejecuciones registradas</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-700 text-slate-400 text-left">
                                    <th className="pb-2 pr-3">Fecha</th>
                                    <th className="pb-2 pr-3">Resultado</th>
                                    <th className="pb-2 pr-3">Condicion</th>
                                    <th className="pb-2 pr-3">Notificado</th>
                                    <th className="pb-2 pr-3">Duracion</th>
                                    <th className="pb-2">Error</th>
                                </tr>
                            </thead>
                            <tbody>
                                {executions.map((exec) => (
                                    <tr key={exec._id} className="border-b border-slate-800">
                                        <td className="py-2 pr-3 text-slate-300">
                                            {new Date(exec.executedAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </td>
                                        <td className="py-2 pr-3 font-mono text-slate-300">{exec.queryResult ?? '—'}</td>
                                        <td className="py-2 pr-3">
                                            {exec.conditionMet ? (
                                                <span className="text-amber-400">Si</span>
                                            ) : (
                                                <span className="text-slate-500">No</span>
                                            )}
                                        </td>
                                        <td className="py-2 pr-3">
                                            {exec.notificationDispatched ? (
                                                <span className="text-emerald-400">Enviada</span>
                                            ) : exec.skippedReason ? (
                                                <span className="text-slate-500">{exec.skippedReason}</span>
                                            ) : (
                                                <span className="text-slate-600">—</span>
                                            )}
                                        </td>
                                        <td className="py-2 pr-3 text-slate-400">{exec.durationMs ? `${exec.durationMs}ms` : '—'}</td>
                                        <td className="py-2 text-red-400 text-xs max-w-[200px] truncate">{exec.error || ''}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
