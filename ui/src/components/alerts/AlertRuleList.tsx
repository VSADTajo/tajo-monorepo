import { Bell, Clock, Edit2, History, Mail, Play, Trash2, AlertTriangle, CheckCircle2, XCircle, Pause } from 'lucide-react';
import type { AlertRule } from '../../types/alert.types';

interface AlertRuleListProps {
    rules: AlertRule[];
    onToggle: (id: string, enabled: boolean) => void;
    onEdit: (rule: AlertRule) => void;
    onDelete: (id: string) => void;
    onTest: (id: string) => void;
    onHistory: (rule: AlertRule) => void;
}

function getStatusConfig(rule: AlertRule) {
    if (!rule.enabled) {
        return { icon: Pause, label: 'Desactivada', bg: 'bg-slate-700/50', text: 'text-slate-400', dot: 'bg-slate-500' };
    }
    if (rule.consecutiveFailures > 0) {
        return { icon: XCircle, label: 'Error en query', bg: 'bg-red-900/20', text: 'text-red-400', dot: 'bg-red-400' };
    }
    if (rule.lastTriggeredAt) {
        const triggeredAgo = Date.now() - new Date(rule.lastTriggeredAt).getTime();
        if (triggeredAgo < rule.cooldownMinutes * 60 * 1000) {
            return { icon: AlertTriangle, label: 'Disparada', bg: 'bg-amber-900/20', text: 'text-amber-400', dot: 'bg-amber-400' };
        }
    }
    return { icon: CheckCircle2, label: 'Activa', bg: 'bg-emerald-900/20', text: 'text-emerald-400', dot: 'bg-emerald-400' };
}

function formatTimeAgo(date: string | null): string {
    if (!date) return 'nunca';
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'ahora';
    if (minutes < 60) return `hace ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours}h`;
    return `hace ${Math.floor(hours / 24)}d`;
}

function formatDataSource(ds: string): string {
    const map: Record<string, string> = {
        mongodb_local: 'MongoDB',
        pg_predictions: 'Predictions',
        pg_hydro: 'Hydro',
        pg_model: 'Model',
        pg_meteo: 'Meteo',
        pg_user: 'User',
        pg_sftp: 'SFTP',
        pg_notifications: 'Notifications',
    };
    return map[ds] || ds;
}

function formatSeverity(severity: string) {
    switch (severity) {
        case 'CRITICAL': return <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-red-900/40 text-red-400 uppercase">Critica</span>;
        case 'WARNING': return <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-amber-900/40 text-amber-400 uppercase">Advertencia</span>;
        default: return <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-blue-900/40 text-blue-400 uppercase">Info</span>;
    }
}

export function AlertRuleList({ rules, onToggle, onEdit, onDelete, onTest, onHistory }: AlertRuleListProps) {
    if (rules.length === 0) {
        return (
            <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto mb-4 bg-slate-800 rounded-full flex items-center justify-center">
                    <Bell className="w-8 h-8 text-slate-600" />
                </div>
                <p className="text-lg font-medium text-slate-300">No hay alertas configuradas</p>
                <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                    Las alertas monitorean tus bases de datos periodicamente y te notifican cuando algo necesita atencion.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {rules.map((rule) => {
                const status = getStatusConfig(rule);
                const StatusIcon = status.icon;

                return (
                    <div
                        key={rule._id}
                        className={`border border-slate-700/40 rounded-xl p-4 hover:border-slate-600/60 transition-all ${rule.enabled ? 'bg-slate-800/20' : 'bg-slate-800/5 opacity-60'}`}
                    >
                        <div className="flex items-start justify-between gap-4">
                            {/* Left: toggle + info */}
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                                <button
                                    onClick={() => onToggle(rule._id, !rule.enabled)}
                                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 mt-0.5 ${rule.enabled ? 'bg-emerald-600' : 'bg-slate-600'}`}
                                >
                                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${rule.enabled ? 'left-6' : 'left-1'}`} />
                                </button>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="text-sm font-semibold text-slate-200 truncate">{rule.name}</h4>
                                        {formatSeverity(rule.notification.severity)}
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${status.bg} ${status.text}`}>
                                            <StatusIcon className="w-3 h-3" />
                                            {status.label}
                                        </span>
                                    </div>

                                    {rule.description && (
                                        <p className="text-xs text-slate-500 mt-1 truncate">{rule.description}</p>
                                    )}

                                    {/* Metadata row */}
                                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                                        <span className="inline-flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            Cada {rule.intervalMinutes}m
                                        </span>
                                        <span>Fuente: <span className="text-slate-400">{formatDataSource(rule.dataSource)}</span></span>
                                        <span>Chequeado: <span className="text-slate-400">{formatTimeAgo(rule.lastCheckedAt)}</span></span>
                                        {rule.lastResult !== null && (
                                            <span>Resultado: <span className="text-slate-300 font-mono">{rule.lastResult}</span></span>
                                        )}
                                        {rule.lastTriggeredAt && (
                                            <span>Disparo: <span className="text-amber-400">{formatTimeAgo(rule.lastTriggeredAt)}</span></span>
                                        )}
                                        {rule.emails && rule.emails.length > 0 && (
                                            <span className="inline-flex items-center gap-1" title={rule.emails.join(', ')}>
                                                <Mail className="w-3 h-3" />
                                                {rule.emails.length} email{rule.emails.length > 1 ? 's' : ''}
                                            </span>
                                        )}
                                        {rule.lastError && (
                                            <span className="text-red-400 truncate max-w-[200px]" title={rule.lastError}>Error: {rule.lastError}</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right: actions */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <button onClick={() => onTest(rule._id)} className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-500 hover:text-emerald-400 transition-colors" title="Ejecutar test (sin notificar)">
                                    <Play className="w-4 h-4" />
                                </button>
                                <button onClick={() => onHistory(rule)} className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-500 hover:text-blue-400 transition-colors" title="Ver historial de ejecuciones">
                                    <History className="w-4 h-4" />
                                </button>
                                <button onClick={() => onEdit(rule)} className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-500 hover:text-amber-400 transition-colors" title="Editar regla">
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => onDelete(rule._id)} className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-500 hover:text-red-400 transition-colors" title="Eliminar regla">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
