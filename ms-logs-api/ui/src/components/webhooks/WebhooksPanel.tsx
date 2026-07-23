import { Webhook, Plus, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { CreateWebhookData, WebhookEventCatalogItem, WebhookSubscription } from '../../types/webhook.types';
import {
    createWebhook,
    deleteWebhook,
    getWebhookEvents,
    getWebhooks,
    toggleWebhook,
    updateWebhook,
} from '../../api/webhooks';
import { WebhookList } from './WebhookList';
import { WebhookForm } from './WebhookForm';
import { DeliveriesModal } from './DeliveriesModal';

type ViewMode = 'list' | 'create' | 'edit';

export function WebhooksPanel() {
    const [subscriptions, setSubscriptions] = useState<WebhookSubscription[]>([]);
    const [events, setEvents] = useState<WebhookEventCatalogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [editing, setEditing] = useState<WebhookSubscription | null>(null);
    const [deliveriesFor, setDeliveriesFor] = useState<WebhookSubscription | null>(null);

    const fetchSubscriptions = useCallback(async () => {
        try {
            const data = await getWebhooks();
            setSubscriptions(data);
        } catch {
            // silently fail
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        getWebhookEvents().then(setEvents).catch(() => setEvents([]));
        fetchSubscriptions();
        const interval = setInterval(fetchSubscriptions, 30000);
        return () => clearInterval(interval);
    }, [fetchSubscriptions]);

    const handleToggle = async (id: string, active: boolean) => {
        try {
            await toggleWebhook(id, active);
            await fetchSubscriptions();
        } catch {
            // silently fail
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este webhook? Se borrará también su historial de entregas.')) return;
        try {
            await deleteWebhook(id);
            await fetchSubscriptions();
        } catch {
            // silently fail
        }
    };

    const handleSubmit = async (data: CreateWebhookData) => {
        try {
            if (editing?._id) {
                await updateWebhook(editing._id, data);
            } else {
                await createWebhook(data);
            }
            setViewMode('list');
            setEditing(null);
            await fetchSubscriptions();
        } catch (err: unknown) {
            alert(err instanceof Error ? err.message : 'Error guardando el webhook');
        }
    };

    const handleEdit = (sub: WebhookSubscription) => {
        setEditing(sub);
        setViewMode('edit');
    };

    const activeCount = subscriptions.filter((s) => s.active).length;

    return (
        <div className="h-full flex flex-col p-6 overflow-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center shadow-lg shadow-teal-600/20">
                        <Webhook className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Webhooks</h2>
                        <p className="text-sm text-slate-400">
                            {subscriptions.length} suscripciones
                            {activeCount > 0 && <span className="text-emerald-400"> · {activeCount} activas</span>}
                        </p>
                    </div>
                </div>
                {viewMode === 'list' && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchSubscriptions}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                            title="Refrescar"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => {
                                setEditing(null);
                                setViewMode('create');
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-teal-600/20"
                        >
                            <Plus className="w-4 h-4" />
                            Nuevo webhook
                        </button>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 flex-1">
                {loading && viewMode === 'list' ? (
                    <div className="text-center py-16 text-slate-400">Cargando webhooks...</div>
                ) : viewMode === 'list' ? (
                    <WebhookList
                        subscriptions={subscriptions}
                        events={events}
                        onToggle={handleToggle}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onDeliveries={setDeliveriesFor}
                    />
                ) : (
                    <WebhookForm
                        editing={editing}
                        events={events}
                        onSubmit={handleSubmit}
                        onCancel={() => {
                            setViewMode('list');
                            setEditing(null);
                        }}
                    />
                )}
            </div>

            {deliveriesFor && <DeliveriesModal subscription={deliveriesFor} onClose={() => setDeliveriesFor(null)} />}
        </div>
    );
}
