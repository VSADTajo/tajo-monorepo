import { useState } from 'react';
import { usePathsOverview } from '../hooks/usePathsOverview';
import { useFilesList } from '../hooks/useFiles';
import { useToggleSchema } from '../hooks/useSchemaMutations';
import { useCreateCleanupJob, useUpdateCleanupJob, useToggleCleanupJob, useDeleteCleanupJob } from '../hooks/useCleanupJobs';
import { downloadFile } from '../api/files.api';
import type { PathOverview } from '../types/file.types';
import type { CleanupFrequency } from '../types/cleanup-job.types';

const FREQUENCY_OPTIONS: { value: CleanupFrequency; label: string }[] = [
    { value: 'EVERY_5_MIN', label: 'Cada 5 minutos' },
    { value: 'EVERY_15_MIN', label: 'Cada 15 minutos' },
    { value: 'EVERY_30_MIN', label: 'Cada 30 minutos' },
    { value: 'EVERY_HOUR', label: 'Cada hora' },
    { value: 'EVERY_6_HOURS', label: 'Cada 6 horas' },
    { value: 'EVERY_12_HOURS', label: 'Cada 12 horas' },
    { value: 'EVERY_DAY', label: 'Cada día' },
    { value: 'EVERY_WEEK', label: 'Cada semana' },
];

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
}

function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60_000) return 'hace un momento';
    if (diff < 3_600_000) return `hace ${Math.floor(diff / 60_000)} min`;
    if (diff < 86_400_000) return `hace ${Math.floor(diff / 3_600_000)}h`;
    return `hace ${Math.floor(diff / 86_400_000)} días`;
}

function timeUntil(iso: string): string {
    const diff = new Date(iso).getTime() - Date.now();
    if (diff <= 0) return 'ahora';
    if (diff < 3_600_000) return `en ${Math.ceil(diff / 60_000)} min`;
    if (diff < 86_400_000) return `en ${Math.ceil(diff / 3_600_000)}h`;
    return `en ${Math.ceil(diff / 86_400_000)} días`;
}

// ─────────────────────────────────────────────────────────────
// StatsBar
// ─────────────────────────────────────────────────────────────

function StatsBar({ paths }: { paths: PathOverview[] }) {
    const withSchema = paths.filter((p) => p.schema).length;
    const withJob = paths.filter((p) => p.cleanupJob).length;
    const activeJob = paths.filter((p) => p.cleanupJob?.isActive).length;

    const stats = [
        { label: 'rutas', value: paths.length, color: 'text-gray-700' },
        { label: 'con schema', value: withSchema, color: 'text-indigo-700' },
        { label: 'con cleanup', value: withJob, color: 'text-blue-700' },
        { label: 'cleanup activo', value: activeJob, color: 'text-green-700' },
    ];

    return (
        <div className="flex items-center gap-6 mb-6 px-4 py-3 bg-white rounded-lg border border-gray-200 shadow-sm">
            {stats.map((s, i) => (
                <div key={i} className="flex items-baseline gap-1.5">
                    <span className={`text-xl font-bold ${s.color}`}>{s.value}</span>
                    <span className="text-sm text-gray-500">{s.label}</span>
                    {i < stats.length - 1 && <span className="ml-4 text-gray-200">|</span>}
                </div>
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Cleanup Job Panel
// ─────────────────────────────────────────────────────────────

type CleanupPanelMode = 'view' | 'create' | 'edit';

function CleanupJobPanel({ entry }: { entry: PathOverview }) {
    const job = entry.cleanupJob;
    const [mode, setMode] = useState<CleanupPanelMode>(job ? 'view' : 'create');
    const [extensionsInput, setExtensionsInput] = useState(job ? job.extensions.join(', ') : '');
    const [frequency, setFrequency] = useState<CleanupFrequency>(
        (job?.frequency as CleanupFrequency) ?? 'EVERY_DAY',
    );
    const [confirmDelete, setConfirmDelete] = useState(false);

    const createMutation = useCreateCleanupJob();
    const updateMutation = useUpdateCleanupJob();
    const toggleMutation = useToggleCleanupJob();
    const deleteMutation = useDeleteCleanupJob();

    function parseExtensions(raw: string): string[] {
        return raw.split(',').map((s) => s.trim()).filter(Boolean);
    }

    function handleSave() {
        const extensions = parseExtensions(extensionsInput);
        if (extensions.length === 0) return;

        if (mode === 'create') {
            createMutation.mutate(
                { directoryPath: entry.path, extensions, frequency },
                { onSuccess: () => setMode('view') },
            );
        } else if (mode === 'edit' && job) {
            updateMutation.mutate(
                { id: job.id, data: { extensions, frequency } },
                { onSuccess: () => setMode('view') },
            );
        }
    }

    function handleToggle() {
        if (!job) return;
        toggleMutation.mutate({ id: job.id, isActive: !job.isActive });
    }

    function handleDelete() {
        if (!job) return;
        deleteMutation.mutate(job.id, {
            onSuccess: () => {
                setConfirmDelete(false);
                setMode('create');
                setExtensionsInput('');
                setFrequency('EVERY_DAY');
            },
        });
    }

    function handleEditMode() {
        if (!job) return;
        setExtensionsInput(job.extensions.join(', '));
        setFrequency(job.frequency as CleanupFrequency);
        setMode('edit');
    }

    const isSaving = createMutation.isPending || updateMutation.isPending;
    const error = createMutation.error || updateMutation.error || toggleMutation.error || deleteMutation.error;

    return (
        <div className="px-6 py-4 bg-blue-50 border-t border-blue-100">
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-blue-800">Cleanup Job</h4>
                {job && mode === 'view' && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleToggle}
                            disabled={toggleMutation.isPending}
                            title={job.isActive ? 'Desactivar cleanup job' : 'Activar cleanup job'}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                                job.isActive ? 'bg-blue-600' : 'bg-gray-300'
                            }`}
                        >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                                job.isActive ? 'translate-x-4' : 'translate-x-1'
                            }`} />
                        </button>
                        <button
                            onClick={handleEditMode}
                            className="text-xs text-blue-700 hover:text-blue-900 font-medium"
                        >
                            Editar
                        </button>
                        {!confirmDelete ? (
                            <button
                                onClick={() => setConfirmDelete(true)}
                                className="text-xs text-red-600 hover:text-red-800 font-medium"
                            >
                                Eliminar
                            </button>
                        ) : (
                            <span className="flex items-center gap-1 text-xs">
                                <span className="text-gray-700">¿Eliminar?</span>
                                <button
                                    onClick={handleDelete}
                                    disabled={deleteMutation.isPending}
                                    className="text-red-700 font-semibold hover:text-red-900 disabled:opacity-50"
                                >
                                    Confirmar
                                </button>
                                <button
                                    onClick={() => setConfirmDelete(false)}
                                    className="text-gray-500 hover:text-gray-700"
                                >
                                    Cancelar
                                </button>
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* View mode */}
            {job && mode === 'view' && (
                <div className="space-y-2 text-sm">
                    {/* Status + frequency */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            job.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                            {job.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                        <span className="text-gray-600">{job.frequencyLabel}</span>
                    </div>

                    {/* Extensions */}
                    <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-gray-500 text-xs font-medium">Extensiones:</span>
                        {job.extensions.map((ext) => (
                            <span key={ext} className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-xs font-mono text-gray-700">
                                {ext}
                            </span>
                        ))}
                    </div>

                    {/* Next execution */}
                    {job.nextExecutionAt && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <svg className="h-3.5 w-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                            </svg>
                            <span>Próxima ejecución:</span>
                            <span className="font-medium text-gray-700" title={formatDate(job.nextExecutionAt)}>
                                {timeUntil(job.nextExecutionAt)}
                            </span>
                        </div>
                    )}

                    {/* Last execution */}
                    <div className="flex items-center gap-1.5 text-xs">
                        {job.lastExecutedAt ? (
                            <>
                                {job.lastExecutionResult?.error ? (
                                    <svg className="h-3.5 w-3.5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                                    </svg>
                                ) : (
                                    <svg className="h-3.5 w-3.5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                    </svg>
                                )}
                                <span className="text-gray-500">Última ejecución:</span>
                                <span className="text-gray-700 font-medium" title={formatDate(job.lastExecutedAt)}>
                                    {relativeTime(job.lastExecutedAt)}
                                </span>
                                {job.lastExecutionResult && !job.lastExecutionResult.error && (
                                    <span className="text-green-600">·&nbsp;{job.lastExecutionResult.filesDeleted} archivos eliminados</span>
                                )}
                                {job.lastExecutionResult?.error && (
                                    <span className="text-red-600">·&nbsp;{job.lastExecutionResult.error}</span>
                                )}
                            </>
                        ) : (
                            <>
                                <svg className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                </svg>
                                <span className="text-gray-400 italic">Nunca ejecutado</span>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Create / Edit form */}
            {(mode === 'create' || mode === 'edit') && (
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                            Extensiones (separadas por coma, ej. .xml, .csv)
                        </label>
                        <input
                            type="text"
                            value={extensionsInput}
                            onChange={(e) => setExtensionsInput(e.target.value)}
                            placeholder=".xml, .csv, .dat"
                            className="w-full text-sm border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Frecuencia</label>
                        <select
                            value={frequency}
                            onChange={(e) => setFrequency(e.target.value as CleanupFrequency)}
                            className="w-full text-sm border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        >
                            {FREQUENCY_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleSave}
                            disabled={isSaving || !extensionsInput.trim()}
                            className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                            {isSaving ? 'Guardando...' : 'Guardar'}
                        </button>
                        {mode === 'edit' && (
                            <button
                                onClick={() => setMode('view')}
                                className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                        )}
                    </div>
                </div>
            )}

            {error && (
                <div className="mt-2 text-xs text-red-600">{(error as Error).message}</div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// PathCard
// ─────────────────────────────────────────────────────────────

function PathCard({ entry, searchTerm }: { entry: PathOverview; searchTerm: string }) {
    const [expanded, setExpanded] = useState(false);
    const [showCleanup, setShowCleanup] = useState(false);
    const [currentDir, setCurrentDir] = useState(entry.path);
    const { data: items, isLoading: filesLoading, error: filesError } = useFilesList(
        entry.canListFiles ? currentDir : undefined,
        expanded,
    );
    const toggleMutation = useToggleSchema();

    const allFiles = items?.filter((f) => !f.isDirectory) ?? [];
    const files = searchTerm
        ? allFiles.filter((f) => f.name.toLowerCase().includes(searchTerm.toLowerCase()))
        : allFiles;
    const dirs = items?.filter((f) => f.isDirectory) ?? [];

    // Breadcrumb segments relative to entry.path root
    function getBreadcrumbs() {
        const root = entry.path;
        if (currentDir === root) return [];
        const relative = currentDir.slice(root.length).replace(/^\//, '');
        const parts = relative.split('/');
        return parts.map((part, i) => ({
            label: part,
            path: root + '/' + parts.slice(0, i + 1).join('/'),
        }));
    }

    function handleToggle(e: React.MouseEvent) {
        e.stopPropagation();
        if (!entry.schema) return;
        toggleMutation.mutate({ id: entry.schema.id, isActive: !entry.schema.isActive });
    }

    function handleClockClick(e: React.MouseEvent) {
        e.stopPropagation();
        setShowCleanup((v) => !v);
    }

    const hasJob = !!entry.cleanupJob;
    const jobActive = hasJob && entry.cleanupJob!.isActive;
    const fileCount = items !== undefined ? files.length : null;

    return (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Header row */}
            <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors select-none"
                onClick={() => setExpanded((v) => !v)}
            >
                {/* Left: chevron + folder icon + path + badges */}
                <div className="flex items-center gap-3 min-w-0">
                    <svg
                        className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
                        fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                    <svg
                        className="h-5 w-5 text-yellow-500 flex-shrink-0"
                        fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                    </svg>
                    <span className="text-sm font-mono text-gray-800 truncate">{entry.displayPath}</span>
                    {!entry.canListFiles && (
                        <span className="inline-flex items-center gap-1 text-xs text-orange-500 flex-shrink-0">
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                            </svg>
                            fuera del storage
                        </span>
                    )}
                    {/* File count badge — visible once files are loaded */}
                    {expanded && fileCount !== null && (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full flex-shrink-0">
                            {fileCount} {fileCount === 1 ? 'archivo' : 'archivos'}
                        </span>
                    )}
                </div>

                {/* Right: cleanup badge + clock + schema info */}
                <div
                    className="flex items-center gap-3 ml-4 flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Cleanup job badge */}
                    {hasJob && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            jobActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                            {jobActive && entry.cleanupJob!.nextExecutionAt
                                ? `Cleanup · ${timeUntil(entry.cleanupJob!.nextExecutionAt)}`
                                : jobActive ? 'Cleanup activo' : 'Cleanup inactivo'}
                        </span>
                    )}

                    {/* Clock icon */}
                    <button
                        onClick={handleClockClick}
                        title="Configurar cleanup job"
                        className={`p-1 rounded hover:bg-gray-100 transition-colors focus:outline-none ${
                            showCleanup
                                ? 'text-blue-600 bg-blue-50'
                                : hasJob
                                    ? jobActive ? 'text-blue-600' : 'text-gray-400'
                                    : 'text-gray-300 hover:text-gray-500'
                        }`}
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                        </svg>
                    </button>

                    {/* Schema info + toggle */}
                    {entry.schema ? (
                        <>
                            {/* Format arrow */}
                            <span className="hidden sm:flex items-center gap-1 text-xs text-gray-500">
                                <span className="uppercase font-medium text-gray-600">{entry.schema.inputFormat}</span>
                                <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                                </svg>
                                <span className="uppercase font-medium text-gray-600">{entry.schema.outputFormat}</span>
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                entry.schema.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                                {entry.schema.isActive ? 'Schema activo' : 'Schema inactivo'}
                            </span>
                            <button
                                onClick={handleToggle}
                                disabled={toggleMutation.isPending}
                                title={entry.schema.isActive ? 'Desactivar schema' : 'Activar schema'}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                                    entry.schema.isActive ? 'bg-indigo-600' : 'bg-gray-300'
                                }`}
                            >
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                                    entry.schema.isActive ? 'translate-x-4' : 'translate-x-1'
                                }`} />
                            </button>
                        </>
                    ) : (
                        <span className="text-xs text-gray-400 italic">Sin schema</span>
                    )}
                </div>
            </div>

            {/* Cleanup Job Panel */}
            {showCleanup && <CleanupJobPanel entry={entry} />}

            {/* Files panel */}
            {expanded && (
                <div className="border-t border-gray-100">
                    {!entry.canListFiles && (
                        <div className="px-6 py-4 text-sm text-orange-500">
                            Esta ruta está fuera del directorio base de storage y no puede explorarse.
                        </div>
                    )}
                    {entry.canListFiles && filesLoading && (
                        <div className="px-6 py-4 space-y-2 animate-pulse">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="flex gap-6">
                                    <div className="h-3 bg-gray-100 rounded w-48" />
                                    <div className="h-3 bg-gray-100 rounded w-16" />
                                    <div className="h-3 bg-gray-100 rounded w-32" />
                                </div>
                            ))}
                        </div>
                    )}
                    {entry.canListFiles && filesError && (
                        <div className="px-6 py-4 text-sm text-red-500">
                            No se pudieron cargar los archivos: {filesError.message}
                        </div>
                    )}
                    {/* Breadcrumb navigation */}
                    {entry.canListFiles && (() => {
                        const breadcrumbs = getBreadcrumbs();
                        return breadcrumbs.length > 0 ? (
                            <div className="px-6 py-2 flex items-center gap-1 text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                                <button
                                    onClick={() => setCurrentDir(entry.path)}
                                    className="hover:text-indigo-600 font-medium truncate max-w-xs"
                                >
                                    {entry.displayPath}
                                </button>
                                {breadcrumbs.map((crumb, i) => (
                                    <span key={crumb.path} className="flex items-center gap-1">
                                        <svg className="h-3 w-3 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                                        </svg>
                                        {i < breadcrumbs.length - 1 ? (
                                            <button
                                                onClick={() => setCurrentDir(crumb.path)}
                                                className="hover:text-indigo-600 font-medium"
                                            >
                                                {crumb.label}
                                            </button>
                                        ) : (
                                            <span className="text-gray-700 font-semibold">{crumb.label}</span>
                                        )}
                                    </span>
                                ))}
                            </div>
                        ) : null;
                    })()}

                    {entry.canListFiles && !filesLoading && !filesError && dirs.length === 0 && files.length === 0 && (
                        <div className="px-6 py-4 text-sm text-gray-400 italic">No hay archivos en este directorio</div>
                    )}
                    {entry.canListFiles && items && (dirs.length > 0 || files.length > 0) && (
                        <table className="min-w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                                    <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tamaño</th>
                                    <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Modificado</th>
                                    <th className="px-6 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {/* Directories first */}
                                {dirs.map((dir) => (
                                    <tr
                                        key={dir.path}
                                        className="hover:bg-yellow-50 cursor-pointer"
                                        onClick={() => setCurrentDir(dir.path)}
                                    >
                                        <td className="px-6 py-3 text-sm font-mono text-gray-700">
                                            <span className="inline-flex items-center gap-2">
                                                <svg className="h-4 w-4 text-yellow-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                                                </svg>
                                                {dir.name}/
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-sm text-gray-400">—</td>
                                        <td className="px-6 py-3 text-sm text-gray-500 hidden sm:table-cell">
                                            {new Date(dir.modifiedAt).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                                                </svg>
                                                Abrir
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {/* Files */}
                                {files.map((file) => (
                                    <tr key={file.path} className="hover:bg-gray-50">
                                        <td className="px-6 py-3 text-sm font-mono text-gray-700">{file.name}</td>
                                        <td className="px-6 py-3 text-sm text-gray-500">{formatSize(file.size)}</td>
                                        <td className="px-6 py-3 text-sm text-gray-500 hidden sm:table-cell">
                                            {new Date(file.modifiedAt).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <button
                                                type="button"
                                                onClick={() => downloadFile(file.path, file.name)}
                                                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                                            >
                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                                </svg>
                                                Descargar
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// PathsSkeleton
// ─────────────────────────────────────────────────────────────

function PathsSkeleton() {
    return (
        <div className="space-y-3 animate-pulse">
            {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-4 w-4 bg-gray-200 rounded" />
                            <div className="h-5 w-5 bg-yellow-100 rounded" />
                            <div className="h-4 bg-gray-200 rounded" style={{ width: 180 + i * 40 }} />
                        </div>
                        <div className="flex gap-3">
                            <div className="h-5 w-24 bg-gray-100 rounded-full" />
                            <div className="h-5 w-20 bg-gray-100 rounded-full" />
                            <div className="h-5 w-9 bg-gray-100 rounded-full" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export function PathsManagerPage() {
    const { data: paths, isLoading, error } = usePathsOverview();
    const [searchTerm, setSearchTerm] = useState('');

    return (
        <div>
            <div className="mb-4">
                <h1 className="text-2xl font-bold text-gray-900">Paths & Files</h1>
                <p className="mt-1 text-sm text-gray-500">
                    Todas las rutas configuradas vía usuarios SFTP o schemas de mapeo.
                    Cada ruta puede tener un schema de transformación y un cleanup job programado.
                </p>
            </div>

            {error && (
                <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    Error cargando rutas: {error.message}
                </div>
            )}

            {isLoading ? (
                <>
                    <div className="mb-6 h-14 bg-white rounded-lg border border-gray-200 animate-pulse" />
                    <PathsSkeleton />
                </>
            ) : !paths || paths.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg border border-gray-200 text-gray-400">
                    <svg className="mx-auto h-10 w-10 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                    </svg>
                    <p className="text-sm">No hay rutas configuradas.</p>
                    <p className="text-xs mt-1">Agregá usuarios SFTP o schemas de mapeo para comenzar.</p>
                </div>
            ) : (
                <>
                    <StatsBar paths={paths} />
                    <input
                        type="text"
                        placeholder="Buscar archivo por nombre..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full mb-4 px-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <div className="space-y-3">
                        {paths.map((entry) => (
                            <PathCard key={entry.displayPath} entry={entry} searchTerm={searchTerm} />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
