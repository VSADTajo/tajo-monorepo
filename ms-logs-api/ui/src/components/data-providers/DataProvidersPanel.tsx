import { AlertTriangle, CheckCircle2, DatabaseZap, Loader2, Plus, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createProvider,
  deleteProvider,
  listIngestionRuns,
  listProviders,
  toErrorMessage,
  toggleProvider,
  triggerIngestion,
  updateProvider,
} from './api';
import IngestionRunsTable from './IngestionRunsTable';
import ProviderFormModal from './ProviderFormModal';
import ProvidersTable from './ProvidersTable';
import type { IngestionRun, ProviderConfig, ProviderFormValues } from './types';

export default function DataProvidersPanel() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [runs, setRuns] = useState<IngestionRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProviderConfig | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ProviderConfig | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [providerRows, runRows] = await Promise.all([listProviders(), listIngestionRuns()]);
      setProviders(providerRows);
      setRuns(runRows);
    } catch (loadError) {
      setError(toErrorMessage(loadError, 'No se pudieron cargar los proveedores.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Newest run per provider — what the table shows in "última ejecución". */
  const lastRunByProvider = useMemo(() => {
    const map: Record<string, IngestionRun | undefined> = {};
    for (const run of runs) {
      const current = map[run.providerConfigId];
      if (!current || new Date(run.startedAt) > new Date(current.startedAt)) {
        map[run.providerConfigId] = run;
      }
    }
    return map;
  }, [runs]);

  const selected = useMemo(
    () => providers.find((provider) => provider.id === selectedId) ?? null,
    [providers, selectedId],
  );

  const selectedRuns = useMemo(
    () =>
      runs
        .filter((run) => run.providerConfigId === selectedId)
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()),
    [runs, selectedId],
  );

  const activeCount = providers.filter((provider) => provider.isActive).length;

  const onToggle = async (provider: ProviderConfig) => {
    setBusyId(provider.id);
    setError(null);
    setNotice(null);
    try {
      const updated = await toggleProvider(provider.id);
      setProviders((current) =>
        current.map((row) => (row.id === updated.id ? { ...row, isActive: updated.isActive } : row)),
      );
      setNotice(
        updated.isActive
          ? `"${updated.name}" activado: su cron corre cada ${updated.pollingIntervalMinutes} minutos.`
          : `"${updated.name}" desactivado: su cron quedó dado de baja.`,
      );
    } catch (toggleError) {
      setError(toErrorMessage(toggleError, 'No se pudo cambiar el estado.'));
    } finally {
      setBusyId(null);
    }
  };

  const onTrigger = async (provider: ProviderConfig) => {
    setBusyId(provider.id);
    setError(null);
    setNotice(null);
    try {
      const run = await triggerIngestion(provider.id);
      setRuns((current) => [run, ...current.filter((row) => row.id !== run.id)]);
      setSelectedId(provider.id);
      setNotice(
        run.status === 'SUCCESS'
          ? `"${provider.name}": ${run.seriesCount} series y ${run.eventsCount.toLocaleString('es-ES')} eventos publicados.`
          : `"${provider.name}" terminó en ${run.status}: ${run.errorMessage ?? 'sin detalle'}.`,
      );
    } catch (triggerError) {
      setError(toErrorMessage(triggerError, 'No se pudo ejecutar la ingesta.'));
    } finally {
      setBusyId(null);
    }
  };

  const onSubmitForm = async (values: ProviderFormValues) => {
    if (editing) {
      const updated = await updateProvider(editing.id, values);
      setProviders((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      setNotice(`"${updated.name}" actualizado.`);
    } else {
      const created = await createProvider(values);
      setProviders((current) => [created, ...current]);
      setNotice(`"${created.name}" creado, todavía inactivo. Probalo con "Ejecutar ahora" antes de activarlo.`);
    }
    setFormOpen(false);
    setEditing(null);
  };

  const onConfirmDelete = async () => {
    if (!pendingDelete) return;
    const provider = pendingDelete;
    setPendingDelete(null);
    setBusyId(provider.id);
    try {
      await deleteProvider(provider.id);
      setProviders((current) => current.filter((row) => row.id !== provider.id));
      if (selectedId === provider.id) setSelectedId(null);
      setNotice(`"${provider.name}" eliminado.`);
    } catch (deleteError) {
      setError(toErrorMessage(deleteError, 'No se pudo eliminar el proveedor.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-slate-700/50 bg-slate-900 px-6 py-4">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/20 p-2">
              <DatabaseZap className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-100">Proveedores de datos</h1>
              <p className="text-xs text-slate-400">
                Fuentes que alimentan la ingesta de ms-model-api. Activar una y desactivar otra
                cambia el origen sin desplegar nada.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void load()}
              className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
            >
              <RefreshCw className="h-4 w-4" />
              Refrescar
            </button>
            <button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-500"
            >
              <Plus className="h-4 w-4" />
              Nuevo proveedor
            </button>
          </div>
        </div>

      </div>

      {/* Body */}
      <div className="flex-1 space-y-4 overflow-auto p-6">
        {notice && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" />
            <span>{notice}</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
            <span>{error}</span>
          </div>
        )}

            <p className="text-xs text-slate-500">
              {providers.length} proveedor(es), {activeCount} activo(s). Un proveedor inactivo puede
              ejecutarse a mano con «Ejecutar ahora»: sirve para comparar contra el que está en
              producción antes de cambiar el origen.
            </p>

            {loading ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Cargando proveedores…
              </div>
            ) : (
              <ProvidersTable
                providers={providers}
                lastRunByProvider={lastRunByProvider}
                busyId={busyId}
                selectedId={selectedId}
                onSelect={(provider) =>
                  setSelectedId((current) => (current === provider.id ? null : provider.id))
                }
                onToggle={(provider) => void onToggle(provider)}
                onTrigger={(provider) => void onTrigger(provider)}
                onEdit={(provider) => {
                  setEditing(provider);
                  setFormOpen(true);
                }}
                onDelete={(provider) => setPendingDelete(provider)}
              />
            )}

        {selected && <IngestionRunsTable runs={selectedRuns} providerName={selected.name} />}
      </div>

      {formOpen && (
        <ProviderFormModal
          provider={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSubmit={onSubmitForm}
        />
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-100">Eliminar proveedor</h2>
            <p className="mt-2 text-sm text-slate-400">
              Se va a borrar «{pendingDelete.name}» y todo su historial de ejecuciones. Si sólo querés
              dejar de usarlo, desactivalo: se puede volver a encender en cualquier momento.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setPendingDelete(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={() => void onConfirmDelete()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
