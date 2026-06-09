import { HelpCircle, Loader2, Mail, Play, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AlertRule, CreateAlertRuleData, DataSourceInfo, TestQueryResult } from '../../types/alert.types';
import { getDataSources, testQuery } from '../../api/alerts';

interface AlertRuleFormProps {
    editingRule: AlertRule | null;
    onSubmit: (data: CreateAlertRuleData) => void;
    onCancel: () => void;
}

const OPERATORS = [
    { value: 'eq', label: '= (igual a)' },
    { value: 'neq', label: '!= (distinto de)' },
    { value: 'gt', label: '> (mayor que)' },
    { value: 'lt', label: '< (menor que)' },
    { value: 'gte', label: '>= (mayor o igual)' },
    { value: 'lte', label: '<= (menor o igual)' },
];

const SEVERITIES = [
    { value: 'INFO', label: 'Informativa', color: 'text-blue-400', dot: 'bg-blue-400' },
    { value: 'WARNING', label: 'Advertencia', color: 'text-amber-400', dot: 'bg-amber-400' },
    { value: 'CRITICAL', label: 'Critica', color: 'text-red-400', dot: 'bg-red-400' },
];

// ─────────────────────────────────────────────────────────
// Tooltip component
// ─────────────────────────────────────────────────────────

function InfoTooltip({ text }: { text: string }) {
    const [open, setOpen] = useState(false);

    return (
        <span className="relative inline-block ml-1.5 align-middle">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
            >
                <HelpCircle className="w-3.5 h-3.5" />
            </button>
            {open && (
                <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-800 border border-slate-600 rounded-lg shadow-xl text-xs text-slate-300 leading-relaxed">
                    {text}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-600" />
                </div>
            )}
        </span>
    );
}

// ─────────────────────────────────────────────────────────
// Section header
// ─────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
    return (
        <div className="mb-4">
            <h4 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">{title}</h4>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
    );
}

// ─────────────────────────────────────────────────────────
// Form
// ─────────────────────────────────────────────────────────

export function AlertRuleForm({ editingRule, onSubmit, onCancel }: AlertRuleFormProps) {
    const [dataSources, setDataSources] = useState<DataSourceInfo[]>([]);
    const [testResult, setTestResult] = useState<TestQueryResult | null>(null);
    const [testError, setTestError] = useState<string | null>(null);
    const [testing, setTesting] = useState(false);

    const [emailInput, setEmailInput] = useState('');

    const [form, setForm] = useState<CreateAlertRuleData>({
        name: '',
        description: '',
        enabled: true,
        dataSource: 'mongodb_local',
        query: '',
        condition: { operator: 'eq', value: 0, field: 'count' },
        intervalMinutes: 10,
        notification: { severity: 'WARNING', title: '', message: '' },
        cooldownMinutes: 30,
        emails: [],
    });

    useEffect(() => {
        getDataSources().then(setDataSources).catch(() => {});
    }, []);

    useEffect(() => {
        if (editingRule) {
            setForm({
                name: editingRule.name,
                description: editingRule.description,
                enabled: editingRule.enabled,
                dataSource: editingRule.dataSource,
                query: editingRule.query,
                condition: editingRule.condition,
                intervalMinutes: editingRule.intervalMinutes,
                notification: editingRule.notification,
                cooldownMinutes: editingRule.cooldownMinutes,
                emails: editingRule.emails ?? [],
            });
        }
    }, [editingRule]);

    const handleTestQuery = async () => {
        setTesting(true);
        setTestResult(null);
        setTestError(null);
        try {
            const result = await testQuery(form.dataSource, form.query);
            setTestResult(result);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error ejecutando query';
            setTestError(msg);
        } finally {
            setTesting(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(form);
    };

    const inputClass = 'w-full bg-slate-800/80 border border-slate-600/50 rounded-lg px-3 py-2.5 text-slate-200 placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-all';
    const labelClass = 'block text-sm font-medium text-slate-400 mb-1.5';

    return (
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-white">
                        {editingRule?._id ? 'Editar regla de alerta' : 'Nueva regla de alerta'}
                    </h3>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Configura una regla que evalua periodicamente una consulta y notifica si se cumple la condicion.
                    </p>
                </div>
                <button type="button" onClick={onCancel} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* ─── Seccion: Identificacion ─── */}
            <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-5 space-y-4">
                <SectionHeader title="Identificacion" subtitle="Nombre y descripcion de la regla" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>
                            Nombre
                            <InfoTooltip text="Nombre unico para identificar esta alerta. Aparece en la lista y en las notificaciones." />
                        </label>
                        <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="Ej: Sin simulaciones en 2 horas" required />
                    </div>
                    <div>
                        <label className={labelClass}>
                            Descripcion
                            <InfoTooltip text="Texto opcional para explicar que monitorea esta regla y por que es importante." />
                        </label>
                        <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} placeholder="Ej: Detecta si el servicio de predicciones deja de generar datos" />
                    </div>
                </div>
            </div>

            {/* ─── Seccion: Consulta ─── */}
            <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-5 space-y-4">
                <SectionHeader title="Consulta" subtitle="Base de datos y query que se ejecuta periodicamente" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>
                            Fuente de datos
                            <InfoTooltip text="Base de datos donde se ejecuta la consulta. MongoDB para logs y forecasts locales. PostgreSQL para las bases de cada microservicio (predictions, hydro, model, etc.)." />
                        </label>
                        <select value={form.dataSource} onChange={(e) => setForm({ ...form, dataSource: e.target.value })} className={inputClass}>
                            {dataSources.map((ds) => (
                                <option key={ds.id} value={ds.id}>
                                    {ds.name} {ds.status === 'disconnected' ? ' (desconectado)' : ''}
                                </option>
                            ))}
                            {dataSources.length === 0 && (
                                <>
                                    <option value="mongodb_local">MongoDB (Logs y Forecasts)</option>
                                    <option value="pg_predictions">PostgreSQL Predictions</option>
                                    <option value="pg_hydro">PostgreSQL Hydro</option>
                                    <option value="pg_model">PostgreSQL Model</option>
                                    <option value="pg_meteo">PostgreSQL Meteo</option>
                                    <option value="pg_user">PostgreSQL User</option>
                                    <option value="pg_sftp">PostgreSQL SFTP</option>
                                    <option value="pg_notifications">PostgreSQL Notifications</option>
                                </>
                            )}
                        </select>
                    </div>
                    <div className="flex items-end">
                        <div className="px-4 py-2.5 bg-slate-700/50 rounded-lg text-xs text-slate-400 w-full">
                            {form.dataSource === 'mongodb_local'
                                ? 'Formato: JSON con collection y filter. Devuelve el COUNT de documentos que coinciden.'
                                : 'Formato: SQL. El resultado debe ser una sola fila con un valor numerico (ej: COUNT, SUM).'}
                        </div>
                    </div>
                </div>

                <div>
                    <label className={labelClass}>
                        Query
                        <InfoTooltip text={form.dataSource === 'mongodb_local'
                            ? 'Filtro JSON para MongoDB. Usa $NOW-N para fechas relativas (N = minutos atras). Ejemplo: $NOW-120 = hace 2 horas.'
                            : 'Consulta SQL de solo lectura. Debe devolver un valor numerico en la primera columna. No se pueden ejecutar INSERT, UPDATE o DELETE.'} />
                    </label>
                    <textarea
                        value={form.query}
                        onChange={(e) => setForm({ ...form, query: e.target.value })}
                        rows={4}
                        className={`${inputClass} font-mono text-sm`}
                        placeholder={form.dataSource === 'mongodb_local'
                            ? '{"collection":"logs","filter":{"level":"error","createdAt":{"$gte":"$NOW-60"}}}'
                            : "SELECT COUNT(*) as count FROM simulations WHERE created_at > NOW() - INTERVAL '2 hours'"
                        }
                        required
                    />

                    {/* Test query */}
                    <div className="flex items-center gap-3 mt-3">
                        <button
                            type="button"
                            onClick={handleTestQuery}
                            disabled={testing || !form.query}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-700/80 hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm rounded-lg font-medium transition-colors"
                        >
                            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                            Probar consulta
                        </button>
                        {testResult && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-900/30 border border-emerald-700/30 rounded-lg">
                                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                <span className="text-sm text-emerald-300">Resultado: <strong className="font-mono">{testResult.result}</strong></span>
                                <span className="text-xs text-emerald-600">({testResult.durationMs}ms)</span>
                            </div>
                        )}
                        {testError && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-900/30 border border-red-700/30 rounded-lg">
                                <div className="w-2 h-2 rounded-full bg-red-400" />
                                <span className="text-sm text-red-300">{testError}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── Seccion: Condicion ─── */}
            <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-5 space-y-4">
                <SectionHeader title="Condicion" subtitle="Cuando el resultado de la consulta cumple esta condicion, se dispara la alerta" />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                        <label className={labelClass}>
                            Resultado de la query
                        </label>
                        <div className="px-3 py-2.5 bg-slate-700/30 border border-slate-600/30 rounded-lg text-slate-400 text-sm text-center">
                            resultado
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>
                            Operador
                            <InfoTooltip text="Como se compara el resultado de la query con el valor. Por ejemplo: si el resultado es 0 y el operador es '= igual a' con valor 0, la condicion se cumple." />
                        </label>
                        <select
                            value={form.condition.operator}
                            onChange={(e) => setForm({ ...form, condition: { ...form.condition, operator: e.target.value as 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' } })}
                            className={inputClass}
                        >
                            {OPERATORS.map((op) => (
                                <option key={op.value} value={op.value}>{op.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>
                            Valor a comparar
                            <InfoTooltip text="El numero contra el que se compara el resultado de la query. Ejemplo: si esperas 0 resultados cuando algo falla, pon 0 con operador '= igual a'." />
                        </label>
                        <input
                            type="number"
                            value={form.condition.value}
                            onChange={(e) => setForm({ ...form, condition: { ...form.condition, value: parseFloat(e.target.value) || 0 } })}
                            className={inputClass}
                        />
                    </div>
                </div>

                {/* Preview de la condicion */}
                <div className="px-4 py-3 bg-slate-700/20 border border-slate-700/30 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Vista previa de la condicion:</p>
                    <p className="text-sm text-slate-300">
                        Si el resultado de la query <strong className="text-blue-400">
                        {OPERATORS.find(o => o.value === form.condition.operator)?.label || '='}
                        </strong> <strong className="text-amber-400 font-mono">{form.condition.value}</strong> → se dispara la alerta
                    </p>
                </div>
            </div>

            {/* ─── Seccion: Frecuencia ─── */}
            <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-5 space-y-4">
                <SectionHeader title="Frecuencia" subtitle="Cada cuanto se evalua y cuanto esperar entre notificaciones" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>
                            Intervalo de evaluacion (minutos)
                            <InfoTooltip text="Cada cuantos minutos se ejecuta la query. Valores validos: 1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30, 60, 120, 180, 240, 360, 480, 720, 1440." />
                        </label>
                        <input
                            type="number"
                            min={1}
                            max={1440}
                            value={form.intervalMinutes}
                            onChange={(e) => setForm({ ...form, intervalMinutes: parseInt(e.target.value) || 10 })}
                            className={inputClass}
                        />
                        <p className="text-xs text-slate-600 mt-1">Cada {form.intervalMinutes} min = {form.intervalMinutes >= 60 ? `${(form.intervalMinutes / 60).toFixed(1)}h` : `${form.intervalMinutes} evaluaciones por hora`}</p>
                    </div>
                    <div>
                        <label className={labelClass}>
                            Cooldown (minutos)
                            <InfoTooltip text="Tiempo minimo entre notificaciones de la misma alerta. Evita recibir la misma notificacion cada pocos minutos. Ejemplo: con cooldown de 60, si la alerta se dispara a las 10:00, no volvera a notificar hasta las 11:00 aunque la condicion siga cumpliendose." />
                        </label>
                        <input
                            type="number"
                            min={1}
                            value={form.cooldownMinutes}
                            onChange={(e) => setForm({ ...form, cooldownMinutes: parseInt(e.target.value) || 30 })}
                            className={inputClass}
                        />
                        <p className="text-xs text-slate-600 mt-1">No re-notificar por {form.cooldownMinutes} min despues de un disparo</p>
                    </div>
                </div>
            </div>

            {/* ─── Seccion: Notificacion ─── */}
            <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-5 space-y-4">
                <SectionHeader title="Notificacion" subtitle="Que se envia cuando la condicion se cumple" />

                <div>
                    <label className={labelClass}>
                        Severidad
                        <InfoTooltip text="Nivel de importancia de la notificacion. Informativa: dato de interes. Advertencia: algo que requiere atencion. Critica: requiere accion inmediata." />
                    </label>
                    <div className="flex gap-3">
                        {SEVERITIES.map((s) => (
                            <button
                                key={s.value}
                                type="button"
                                onClick={() => setForm({ ...form, notification: { ...form.notification, severity: s.value as 'INFO' | 'WARNING' | 'CRITICAL' } })}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                                    form.notification.severity === s.value
                                        ? `${s.color} border-current bg-slate-800`
                                        : 'text-slate-500 border-slate-700/50 hover:border-slate-600 hover:text-slate-300'
                                }`}
                            >
                                <div className={`w-2.5 h-2.5 rounded-full ${form.notification.severity === s.value ? s.dot : 'bg-slate-600'}`} />
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>
                            Titulo
                            <InfoTooltip text="Titulo corto de la notificacion. Se muestra como encabezado. Ejemplo: 'Sin simulaciones nuevas'." />
                        </label>
                        <input
                            type="text"
                            value={form.notification.title}
                            onChange={(e) => setForm({ ...form, notification: { ...form.notification, title: e.target.value } })}
                            className={inputClass}
                            placeholder="Ej: Sin simulaciones nuevas"
                            required
                        />
                    </div>
                    <div>
                        <label className={labelClass}>
                            Mensaje
                            <InfoTooltip text="Texto descriptivo de la notificacion con mas detalle. Se incluye el resultado de la query automaticamente al final." />
                        </label>
                        <input
                            type="text"
                            value={form.notification.message}
                            onChange={(e) => setForm({ ...form, notification: { ...form.notification, message: e.target.value } })}
                            className={inputClass}
                            placeholder="Ej: No se recibieron simulaciones en las ultimas 2 horas"
                            required
                        />
                    </div>
                </div>

                {/* Preview de notificacion */}
                {form.notification.title && (
                    <div className="px-4 py-3 bg-slate-700/20 border border-slate-700/30 rounded-lg">
                        <p className="text-xs text-slate-500 mb-2">Vista previa de la notificacion:</p>
                        <div className="flex items-start gap-3">
                            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${SEVERITIES.find(s => s.value === form.notification.severity)?.dot || 'bg-slate-400'}`} />
                            <div>
                                <p className="text-sm font-medium text-slate-200">{form.notification.title}</p>
                                <p className="text-xs text-slate-400 mt-0.5">{form.notification.message}{form.notification.message ? ' | Resultado: X' : ''}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ─── Seccion: Emails ─── */}
            <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-5 space-y-4">
                <SectionHeader title="Notificacion por email" subtitle="Opcional. Agrega correos para recibir la alerta por email" />

                <div>
                    <label className={labelClass}>
                        Agregar email
                        <InfoTooltip text="Cuando la alerta se dispare, se enviara un email con los detalles a todos los correos de la lista. Usa una cuenta Gmail configurada en el servidor." />
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="email"
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const trimmed = emailInput.trim();
                                    if (trimmed && !form.emails.includes(trimmed)) {
                                        setForm({ ...form, emails: [...form.emails, trimmed] });
                                        setEmailInput('');
                                    }
                                }
                            }}
                            className={`${inputClass} flex-1`}
                            placeholder="ejemplo@gmail.com"
                        />
                        <button
                            type="button"
                            onClick={() => {
                                const trimmed = emailInput.trim();
                                if (trimmed && !form.emails.includes(trimmed)) {
                                    setForm({ ...form, emails: [...form.emails, trimmed] });
                                    setEmailInput('');
                                }
                            }}
                            className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Agregar
                        </button>
                    </div>
                </div>

                {form.emails.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {form.emails.map((email) => (
                            <span key={email} className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-700/50 border border-slate-600/30 rounded-lg text-sm text-slate-300">
                                <Mail className="w-3.5 h-3.5 text-slate-500" />
                                {email}
                                <button
                                    type="button"
                                    onClick={() => setForm({ ...form, emails: form.emails.filter((e) => e !== email) })}
                                    className="text-slate-500 hover:text-red-400 transition-colors"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </span>
                        ))}
                    </div>
                )}

                {form.emails.length === 0 && (
                    <p className="text-xs text-slate-600">Sin emails configurados. La alerta solo se enviara al sistema de notificaciones.</p>
                )}
            </div>

            {/* ─── Botones ─── */}
            <div className="flex items-center gap-3 pt-2">
                <button
                    type="submit"
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-blue-600/20"
                >
                    {editingRule?._id ? 'Guardar cambios' : 'Crear regla'}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-medium transition-colors"
                >
                    Cancelar
                </button>
            </div>
        </form>
    );
}
