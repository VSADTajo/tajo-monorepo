import { useState } from 'react';
import type { CreateWebhookData, WebhookEventCatalogItem, WebhookSubscription } from '../../types/webhook.types';

interface WebhookFormProps {
    editing: WebhookSubscription | null;
    events: WebhookEventCatalogItem[];
    onSubmit: (data: CreateWebhookData) => void;
    onCancel: () => void;
}

const inputClass =
    'w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500';
const labelClass = 'block text-sm font-medium text-slate-300 mb-1';

export function WebhookForm({ editing, events, onSubmit, onCancel }: WebhookFormProps) {
    const [url, setUrl] = useState(editing?.url ?? '');
    const [event, setEvent] = useState(editing?.event ?? events[0]?.event ?? '');
    const [description, setDescription] = useState(editing?.description ?? '');
    const [secret, setSecret] = useState(editing?.secret ?? '');
    const [active, setActive] = useState(editing?.active ?? true);
    const [error, setError] = useState<string | null>(null);

    const selected = events.find((e) => e.event === event);

    const handleSubmit = () => {
        if (!url.trim()) {
            setError('La URL es obligatoria');
            return;
        }
        try {
            const parsed = new URL(url.trim());
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error();
        } catch {
            setError('La URL debe ser http(s) válida');
            return;
        }
        if (!event) {
            setError('Selecciona un evento');
            return;
        }
        onSubmit({ url: url.trim(), event, description: description.trim(), secret: secret.trim() || undefined, active });
    };

    return (
        <div className="max-w-2xl space-y-5">
            <h3 className="text-lg font-semibold text-white">{editing ? 'Editar webhook' : 'Nuevo webhook'}</h3>

            {error && (
                <div className="p-3 bg-red-900/20 border border-red-700/30 rounded-lg text-sm text-red-200">{error}</div>
            )}

            <div>
                <label className={labelClass}>URL del cliente</label>
                <input
                    className={inputClass}
                    placeholder="https://cliente.example.com/webhooks/tajo"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                />
                <p className="text-xs text-slate-500 mt-1">Le haremos un POST a esta URL cuando ocurra el evento.</p>
            </div>

            <div>
                <label className={labelClass}>Evento</label>
                <select className={inputClass} value={event} onChange={(e) => setEvent(e.target.value)}>
                    {events.map((ev) => (
                        <option key={ev.event} value={ev.event}>
                            {ev.label} ({ev.event})
                        </option>
                    ))}
                </select>
                {selected && <p className="text-xs text-slate-500 mt-1">{selected.description}</p>}
            </div>

            <div>
                <label className={labelClass}>Descripción (opcional)</label>
                <input
                    className={inputClass}
                    placeholder="Webhook de FEWS / Idrica"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
            </div>

            <div>
                <label className={labelClass}>Secreto (opcional)</label>
                <input
                    className={inputClass}
                    placeholder="Se usa para firmar el payload (HMAC-SHA256 → cabecera X-Signature)"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                />
                <p className="text-xs text-slate-500 mt-1">
                    Si lo defines, cada POST llevará la cabecera <code className="text-slate-400">X-Signature</code> para que
                    el cliente verifique que somos nosotros.
                </p>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-teal-500 w-4 h-4" />
                Activo
            </label>

            <div className="flex items-center gap-3 pt-2">
                <button
                    onClick={handleSubmit}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-teal-600/20"
                >
                    {editing ? 'Guardar cambios' : 'Crear webhook'}
                </button>
                <button onClick={onCancel} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors">
                    Cancelar
                </button>
            </div>
        </div>
    );
}
