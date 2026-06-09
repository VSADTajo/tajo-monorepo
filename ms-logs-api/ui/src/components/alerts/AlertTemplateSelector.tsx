import { ArrowRight, ChevronLeft, Clock, Code2, Database, FileText, Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { AlertTemplate, CreateAlertRuleData } from '../../types/alert.types';
import { getAlertTemplates } from '../../api/alerts';

interface AlertTemplateSelectorProps {
    onSelect: (data: CreateAlertRuleData) => void;
    onCancel: () => void;
}

const OPERATOR_LABELS: Record<string, string> = {
    eq: '= (igual a)',
    neq: '!= (distinto de)',
    gt: '> (mayor que)',
    lt: '< (menor que)',
    gte: '>= (mayor o igual)',
    lte: '<= (menor o igual)',
};

const SEVERITY_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
    INFO: { label: 'Informativa', dot: 'bg-blue-400', bg: 'bg-blue-900/30', text: 'text-blue-300' },
    WARNING: { label: 'Advertencia', dot: 'bg-amber-400', bg: 'bg-amber-900/30', text: 'text-amber-300' },
    CRITICAL: { label: 'Critica', dot: 'bg-red-400', bg: 'bg-red-900/30', text: 'text-red-300' },
};

function formatDataSource(ds: string): string {
    const map: Record<string, string> = {
        mongodb_local: 'MongoDB (Logs y Forecasts)',
        pg_predictions: 'PostgreSQL Predictions',
        pg_hydro: 'PostgreSQL Hydro',
        pg_model: 'PostgreSQL Model',
        pg_meteo: 'PostgreSQL Meteo',
        pg_user: 'PostgreSQL User',
        pg_sftp: 'PostgreSQL SFTP',
        pg_notifications: 'PostgreSQL Notifications',
    };
    return map[ds] || ds;
}

export function AlertTemplateSelector({ onSelect, onCancel }: AlertTemplateSelectorProps) {
    const [templates, setTemplates] = useState<AlertTemplate[]>([]);
    const [selected, setSelected] = useState<AlertTemplate | null>(null);
    const [variables, setVariables] = useState<Record<string, string | number>>({});

    useEffect(() => {
        getAlertTemplates().then(setTemplates).catch(() => {});
    }, []);

    useEffect(() => {
        if (selected) {
            const defaults: Record<string, string | number> = {};
            for (const v of selected.variables) {
                defaults[v.name] = v.default;
            }
            setVariables(defaults);
        }
    }, [selected]);

    // Live preview: replace variables in query/title/message
    const preview = useMemo(() => {
        if (!selected) return null;

        let query = selected.query;
        let title = selected.notification.title;
        let message = selected.notification.message;

        for (const [key, val] of Object.entries(variables)) {
            const placeholder = `{{${key}}}`;
            const replacement = String(val) || `{{${key}}}`;
            query = query.split(placeholder).join(replacement);
            title = title.split(placeholder).join(replacement);
            message = message.split(placeholder).join(replacement);
        }

        const thresholdVar = selected.variables.find(v => v.name === 'threshold');
        const conditionValue = thresholdVar ? Number(variables['threshold']) || selected.condition.value : selected.condition.value;

        return { query, title, message, conditionValue };
    }, [selected, variables]);

    const handleApply = () => {
        if (!selected || !preview) return;

        onSelect({
            name: preview.title,
            description: selected.description,
            enabled: true,
            dataSource: selected.dataSource,
            query: preview.query,
            condition: { ...selected.condition, value: preview.conditionValue },
            intervalMinutes: selected.intervalMinutes,
            notification: { severity: selected.notification.severity, title: preview.title, message: preview.message },
            cooldownMinutes: selected.cooldownMinutes,
            emails: [],
        });
    };

    // ─── Detail view ───
    if (selected && preview) {
        const sev = SEVERITY_CONFIG[selected.notification.severity] || SEVERITY_CONFIG.INFO;

        return (
            <div className="max-w-3xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h3 className="text-lg font-semibold text-white">{selected.name}</h3>
                        <p className="text-sm text-slate-500">{selected.description}</p>
                    </div>
                </div>

                {/* Variables */}
                {selected.variables.length > 0 && (
                    <div className="bg-blue-900/15 border border-blue-700/30 rounded-xl p-5 space-y-4">
                        <h4 className="text-sm font-semibold text-blue-300 uppercase tracking-wider">Parametros personalizables</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {selected.variables.map((v) => (
                                <div key={v.name}>
                                    <label className="block text-sm font-medium text-slate-400 mb-1.5">{v.label}</label>
                                    <input
                                        type={v.type === 'number' ? 'number' : 'text'}
                                        value={variables[v.name] ?? ''}
                                        onChange={(e) => setVariables({ ...variables, [v.name]: v.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value })}
                                        className="w-full bg-slate-800/80 border border-slate-600/50 rounded-lg px-3 py-2.5 text-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-all"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Full config preview */}
                <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-5 space-y-5">
                    <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Configuracion resultante</h4>

                    {/* Query */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <Code2 className="w-4 h-4 text-slate-500" />
                            <span className="text-xs font-medium text-slate-400 uppercase">Query</span>
                        </div>
                        <pre className="bg-slate-900/80 border border-slate-700/50 rounded-lg p-3 text-sm text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap break-all">
                            {preview.query}
                        </pre>
                    </div>

                    {/* Grid: source, condition, frequency */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-900/50 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <Database className="w-3.5 h-3.5 text-slate-500" />
                                <span className="text-[10px] font-semibold text-slate-500 uppercase">Fuente de datos</span>
                            </div>
                            <p className="text-sm text-slate-300">{formatDataSource(selected.dataSource)}</p>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                                <span className="text-[10px] font-semibold text-slate-500 uppercase">Condicion</span>
                            </div>
                            <p className="text-sm text-slate-300">
                                resultado <span className="text-blue-400">{OPERATOR_LABELS[selected.condition.operator] || selected.condition.operator}</span> <span className="text-amber-400 font-mono">{preview.conditionValue}</span>
                            </p>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <Clock className="w-3.5 h-3.5 text-slate-500" />
                                <span className="text-[10px] font-semibold text-slate-500 uppercase">Frecuencia</span>
                            </div>
                            <p className="text-sm text-slate-300">Cada {selected.intervalMinutes} min · Cooldown {selected.cooldownMinutes} min</p>
                        </div>
                    </div>

                    {/* Notification preview */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <Send className="w-4 h-4 text-slate-500" />
                            <span className="text-xs font-medium text-slate-400 uppercase">Notificacion</span>
                        </div>
                        <div className={`${sev.bg} border border-slate-700/30 rounded-lg p-4`}>
                            <div className="flex items-center gap-2 mb-1">
                                <div className={`w-2.5 h-2.5 rounded-full ${sev.dot}`} />
                                <span className={`text-xs font-semibold uppercase ${sev.text}`}>{sev.label}</span>
                            </div>
                            <p className="text-sm font-medium text-slate-200">{preview.title}</p>
                            <p className="text-xs text-slate-400 mt-1">{preview.message}</p>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                    <button
                        onClick={handleApply}
                        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-blue-600/20"
                    >
                        Usar este template
                        <ArrowRight className="w-4 h-4" />
                    </button>
                    <button onClick={() => setSelected(null)} className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-medium transition-colors">
                        Volver a templates
                    </button>
                </div>

                <p className="text-xs text-slate-600">
                    Al usar este template se abrira el formulario de creacion con todos los campos pre-cargados. Podras modificar cualquier valor antes de guardar.
                </p>
            </div>
        );
    }

    // ─── Template list ───
    return (
        <div className="space-y-5">
            <div>
                <h3 className="text-lg font-semibold text-white">Templates predefinidos</h3>
                <p className="text-sm text-slate-500 mt-1">Alertas comunes listas para usar. Selecciona una para ver la configuracion completa y personalizarla.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((t) => {
                    const sev = SEVERITY_CONFIG[t.notification.severity] || SEVERITY_CONFIG.INFO;

                    return (
                        <button
                            key={t.id}
                            onClick={() => setSelected(t)}
                            className="text-left p-5 bg-slate-800/40 border border-slate-700/40 rounded-xl hover:border-blue-500/50 hover:bg-slate-800/60 transition-all group"
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-blue-400 group-hover:text-blue-300 transition-colors" />
                                    <span className="text-slate-200 font-semibold group-hover:text-white transition-colors">{t.name}</span>
                                </div>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${sev.bg} ${sev.text}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
                                    {sev.label}
                                </span>
                            </div>
                            <p className="text-sm text-slate-400 mb-3">{t.description}</p>
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                                <span className="flex items-center gap-1">
                                    <Database className="w-3 h-3" />
                                    {formatDataSource(t.dataSource).split(' ')[0]}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Cada {t.intervalMinutes}m
                                </span>
                                <span>
                                    {OPERATOR_LABELS[t.condition.operator]?.split(' ')[0]} {t.condition.value}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>

            <button onClick={onCancel} className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-medium transition-colors">
                Cancelar
            </button>
        </div>
    );
}
