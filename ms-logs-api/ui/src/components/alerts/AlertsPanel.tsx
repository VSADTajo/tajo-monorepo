import { Bell, Plus, FileText, RefreshCw, HelpCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { AlertRule, CreateAlertRuleData } from '../../types/alert.types';
import { createAlertRule, deleteAlertRule, getAlertRules, testAlertRule, toggleAlertRule, updateAlertRule } from '../../api/alerts';
import { AlertRuleList } from './AlertRuleList';
import { AlertRuleForm } from './AlertRuleForm';
import { AlertHistoryModal } from './AlertHistoryModal';
import { AlertTemplateSelector } from './AlertTemplateSelector';

type ViewMode = 'list' | 'create' | 'edit' | 'template';

export function AlertsPanel() {
    const [rules, setRules] = useState<AlertRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
    const [historyRule, setHistoryRule] = useState<AlertRule | null>(null);
    const [testMessage, setTestMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [showHelp, setShowHelp] = useState(false);

    const fetchRules = useCallback(async () => {
        try {
            const data = await getAlertRules();
            setRules(data);
        } catch {
            // silently fail
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRules();
        const interval = setInterval(fetchRules, 30000);
        return () => clearInterval(interval);
    }, [fetchRules]);

    const handleToggle = async (id: string, enabled: boolean) => {
        try {
            await toggleAlertRule(id, enabled);
            await fetchRules();
        } catch {
            // silently fail
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Seguro que quieres eliminar esta regla? Se eliminara tambien su historial de ejecuciones.')) return;
        try {
            await deleteAlertRule(id);
            await fetchRules();
        } catch {
            // silently fail
        }
    };

    const handleTest = async (id: string) => {
        setTestMessage(null);
        try {
            const result = await testAlertRule(id);
            setTestMessage({
                type: result.conditionMet ? 'error' : 'success',
                text: `Resultado: ${result.queryResult} | Condicion ${result.conditionMet ? 'CUMPLIDA' : 'no cumplida'} | ${result.wouldNotify ? 'Se enviaria notificacion' : result.cooldownActive ? 'No notifica (cooldown activo)' : 'No notifica'} | ${result.durationMs}ms`,
            });
        } catch (err: unknown) {
            setTestMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error en test' });
        }
    };

    const handleSubmit = async (data: CreateAlertRuleData) => {
        try {
            if (editingRule?._id) {
                await updateAlertRule(editingRule._id, data);
            } else {
                await createAlertRule(data);
            }
            setViewMode('list');
            setEditingRule(null);
            await fetchRules();
        } catch (err: unknown) {
            alert(err instanceof Error ? err.message : 'Error guardando regla');
        }
    };

    const handleEdit = (rule: AlertRule) => {
        setEditingRule(rule);
        setViewMode('edit');
    };

    const handleTemplateSelect = (data: CreateAlertRuleData) => {
        setEditingRule({ ...data, _id: '', lastCheckedAt: null, lastResult: null, lastTriggeredAt: null, consecutiveFailures: 0, lastError: null, templateId: null, createdAt: '', updatedAt: '' } as AlertRule);
        setViewMode('create');
    };

    const activeCount = rules.filter(r => r.enabled).length;
    const errorCount = rules.filter(r => r.enabled && r.consecutiveFailures > 0).length;
    const triggeredCount = rules.filter(r => r.enabled && r.lastTriggeredAt && (Date.now() - new Date(r.lastTriggeredAt).getTime() < r.cooldownMinutes * 60 * 1000)).length;

    return (
        <div className="h-full flex flex-col p-6 overflow-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center shadow-lg shadow-amber-600/20">
                        <Bell className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Alertas</h2>
                        <p className="text-sm text-slate-400">
                            {rules.length} reglas
                            {activeCount > 0 && <span className="text-emerald-400"> · {activeCount} activas</span>}
                            {triggeredCount > 0 && <span className="text-amber-400"> · {triggeredCount} disparadas</span>}
                            {errorCount > 0 && <span className="text-red-400"> · {errorCount} con error</span>}
                        </p>
                    </div>
                </div>
                {viewMode === 'list' && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowHelp(!showHelp)}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                            title="Ayuda"
                        >
                            <HelpCircle className="w-4 h-4" />
                        </button>
                        <button
                            onClick={fetchRules}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                            title="Refrescar"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('template')}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
                        >
                            <FileText className="w-4 h-4" />
                            Desde template
                        </button>
                        <button
                            onClick={() => { setEditingRule(null); setViewMode('create'); }}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-blue-600/20"
                        >
                            <Plus className="w-4 h-4" />
                            Nueva regla
                        </button>
                    </div>
                )}
            </div>

            {/* Help banner */}
            {showHelp && viewMode === 'list' && (
                <div className="mb-4 p-4 bg-blue-900/20 border border-blue-700/30 rounded-xl text-sm text-blue-200 space-y-2">
                    <div className="flex items-center justify-between">
                        <h4 className="font-semibold">Como funcionan las alertas</h4>
                        <button onClick={() => setShowHelp(false)} className="text-blue-400 hover:text-white text-xs">Cerrar</button>
                    </div>
                    <ul className="space-y-1 text-blue-300/80 text-xs list-disc list-inside">
                        <li><strong>Crear una regla:</strong> Define una consulta SQL o MongoDB que se ejecuta periodicamente.</li>
                        <li><strong>Condicion:</strong> Si el resultado de la query cumple la condicion (ej: resultado = 0), la alerta se dispara.</li>
                        <li><strong>Notificacion:</strong> Cuando se dispara, se envia una notificacion al sistema de notificaciones con la severidad configurada.</li>
                        <li><strong>Cooldown:</strong> Evita recibir la misma alerta repetidamente. Despues de un disparo, espera el cooldown antes de volver a notificar.</li>
                        <li><strong>Templates:</strong> Alertas predefinidas para situaciones comunes (sin simulaciones, estacion sin datos, errores excesivos).</li>
                        <li><strong>Test:</strong> Ejecuta la query de una regla sin enviar notificacion, para ver que resultado daria.</li>
                        <li><strong>Historial:</strong> Cada ejecucion queda registrada por 30 dias para poder diagnosticar problemas.</li>
                    </ul>
                </div>
            )}

            {/* Test message banner */}
            {testMessage && (
                <div className={`mb-4 p-3 rounded-xl text-sm flex items-center justify-between ${
                    testMessage.type === 'error'
                        ? 'bg-amber-900/20 border border-amber-700/30 text-amber-200'
                        : 'bg-emerald-900/20 border border-emerald-700/30 text-emerald-200'
                }`}>
                    <span>{testMessage.text}</span>
                    <button onClick={() => setTestMessage(null)} className="ml-3 opacity-50 hover:opacity-100 text-xs">Cerrar</button>
                </div>
            )}

            {/* Content */}
            <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 flex-1">
                {loading && viewMode === 'list' ? (
                    <div className="text-center py-16 text-slate-400">Cargando alertas...</div>
                ) : viewMode === 'list' ? (
                    <AlertRuleList
                        rules={rules}
                        onToggle={handleToggle}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onTest={handleTest}
                        onHistory={setHistoryRule}
                    />
                ) : viewMode === 'template' ? (
                    <AlertTemplateSelector
                        onSelect={handleTemplateSelect}
                        onCancel={() => setViewMode('list')}
                    />
                ) : (
                    <AlertRuleForm
                        editingRule={editingRule}
                        onSubmit={handleSubmit}
                        onCancel={() => { setViewMode('list'); setEditingRule(null); }}
                    />
                )}
            </div>

            {/* History modal */}
            {historyRule && (
                <AlertHistoryModal rule={historyRule} onClose={() => setHistoryRule(null)} />
            )}
        </div>
    );
}
