import { useEffect, useState } from 'react';
import { X, CheckCircle2, XCircle } from 'lucide-react';
import type { WebhookDelivery, WebhookSubscription } from '../../types/webhook.types';
import { getWebhookDeliveries } from '../../api/webhooks';

interface DeliveriesModalProps {
    subscription: WebhookSubscription;
    onClose: () => void;
}

export function DeliveriesModal({ subscription, onClose }: DeliveriesModalProps) {
    const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        getWebhookDeliveries(subscription._id)
            .then((data) => active && setDeliveries(data))
            .catch(() => active && setDeliveries([]))
            .finally(() => active && setLoading(false));
        return () => {
            active = false;
        };
    }, [subscription._id]);

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-slate-700">
                    <div>
                        <h3 className="text-lg font-semibold text-white">Entregas</h3>
                        <p className="text-xs text-slate-400 truncate max-w-md">{subscription.url}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 overflow-auto">
                    {loading ? (
                        <div className="text-center py-12 text-slate-400">Cargando entregas...</div>
                    ) : deliveries.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">Todavía no hay entregas para este webhook.</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-slate-400 border-b border-slate-700/50">
                                    <th className="py-2 px-2 font-medium">Estado</th>
                                    <th className="py-2 px-2 font-medium">Evento</th>
                                    <th className="py-2 px-2 font-medium">HTTP</th>
                                    <th className="py-2 px-2 font-medium">Intentos</th>
                                    <th className="py-2 px-2 font-medium">Fecha</th>
                                </tr>
                            </thead>
                            <tbody>
                                {deliveries.map((d) => (
                                    <tr key={d._id} className="border-b border-slate-800/50">
                                        <td className="py-2 px-2">
                                            {d.success ? (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                            ) : (
                                                <span title={d.error ?? ''}>
                                                    <XCircle className="w-4 h-4 text-red-400" />
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-2 px-2 text-slate-300">{d.event}</td>
                                        <td className="py-2 px-2 text-slate-300">{d.responseStatus ?? '—'}</td>
                                        <td className="py-2 px-2 text-slate-300">{d.attempts}</td>
                                        <td className="py-2 px-2 text-slate-400">{new Date(d.createdAt).toLocaleString()}</td>
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
