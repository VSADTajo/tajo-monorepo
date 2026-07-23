import { Pencil, Trash2, History, Webhook } from 'lucide-react';
import type { WebhookEventCatalogItem, WebhookSubscription } from '../../types/webhook.types';

interface WebhookListProps {
    subscriptions: WebhookSubscription[];
    events: WebhookEventCatalogItem[];
    onToggle: (id: string, active: boolean) => void;
    onEdit: (sub: WebhookSubscription) => void;
    onDelete: (id: string) => void;
    onDeliveries: (sub: WebhookSubscription) => void;
}

function eventLabel(events: WebhookEventCatalogItem[], event: string): string {
    return events.find((e) => e.event === event)?.label ?? event;
}

export function WebhookList({ subscriptions, events, onToggle, onEdit, onDelete, onDeliveries }: WebhookListProps) {
    if (subscriptions.length === 0) {
        return (
            <div className="text-center py-16 text-slate-400">
                <Webhook className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>No hay webhooks configurados.</p>
                <p className="text-sm text-slate-500 mt-1">Crea uno para avisar a un cliente de los cambios de estado.</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-700/50">
                        <th className="py-3 px-3 font-medium">Estado</th>
                        <th className="py-3 px-3 font-medium">Evento</th>
                        <th className="py-3 px-3 font-medium">URL</th>
                        <th className="py-3 px-3 font-medium">Última entrega</th>
                        <th className="py-3 px-3 font-medium text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {subscriptions.map((sub) => (
                        <tr key={sub._id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                            <td className="py-3 px-3">
                                <button
                                    onClick={() => onToggle(sub._id, !sub.active)}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${sub.active ? 'bg-teal-600' : 'bg-slate-600'}`}
                                    title={sub.active ? 'Activo' : 'Inactivo'}
                                >
                                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${sub.active ? 'translate-x-5' : 'translate-x-1'}`} />
                                </button>
                            </td>
                            <td className="py-3 px-3">
                                <span className="text-slate-200">{eventLabel(events, sub.event)}</span>
                                <div className="text-xs text-slate-500">{sub.event}</div>
                            </td>
                            <td className="py-3 px-3 max-w-xs">
                                <div className="text-slate-300 truncate" title={sub.url}>{sub.url}</div>
                                {sub.description && <div className="text-xs text-slate-500 truncate">{sub.description}</div>}
                            </td>
                            <td className="py-3 px-3">
                                {sub.lastDeliveredAt ? (
                                    <span className={sub.lastError ? 'text-red-400' : 'text-emerald-400'}>
                                        {new Date(sub.lastDeliveredAt).toLocaleString()}
                                        {sub.lastError && <div className="text-xs text-red-400/70 truncate max-w-[180px]" title={sub.lastError}>{sub.lastError}</div>}
                                    </span>
                                ) : (
                                    <span className="text-slate-500">—</span>
                                )}
                            </td>
                            <td className="py-3 px-3">
                                <div className="flex items-center justify-end gap-1">
                                    <button onClick={() => onDeliveries(sub)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors" title="Entregas">
                                        <History className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => onEdit(sub)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors" title="Editar">
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => onDelete(sub._id)} className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors" title="Eliminar">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
