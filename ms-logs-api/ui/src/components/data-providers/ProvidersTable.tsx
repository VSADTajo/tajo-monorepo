import { CheckCircle2, Loader2, Pencil, Play, Power, Trash2, XCircle } from 'lucide-react';
import { TYPE_LABELS } from './types';
import type { IngestionRun, ProviderConfig } from './types';

interface ProvidersTableProps {
  providers: ProviderConfig[];
  lastRunByProvider: Record<string, IngestionRun | undefined>;
  busyId: string | null;
  onToggle: (provider: ProviderConfig) => void;
  onTrigger: (provider: ProviderConfig) => void;
  onEdit: (provider: ProviderConfig) => void;
  onDelete: (provider: ProviderConfig) => void;
  onSelect: (provider: ProviderConfig) => void;
  selectedId: string | null;
}

const TYPE_BADGE: Record<string, string> = {
  WISKI_API: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  CSV_FILE: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  SFTP_FILE: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  FEWS_API: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
};

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('es-ES');
}

function RunBadge({ run }: { run: IngestionRun | undefined }) {
  if (!run) return <span className="text-xs text-slate-500">Sin ejecuciones</span>;

  const tone =
    run.status === 'SUCCESS'
      ? 'text-emerald-300'
      : run.status === 'RUNNING'
        ? 'text-sky-300'
        : run.status === 'PARTIAL'
          ? 'text-amber-300'
          : 'text-red-300';

  return (
    <div className="flex flex-col">
      <span className={`flex items-center gap-1 text-xs font-medium ${tone}`}>
        {run.status === 'SUCCESS' ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : run.status === 'RUNNING' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <XCircle className="h-3.5 w-3.5" />
        )}
        {run.status}
      </span>
      <span className="text-xs text-slate-500">
        {run.seriesCount} series · {run.eventsCount.toLocaleString('es-ES')} eventos
      </span>
      <span className="text-xs text-slate-600">{formatDate(run.startedAt)}</span>
    </div>
  );
}

export default function ProvidersTable({
  providers,
  lastRunByProvider,
  busyId,
  onToggle,
  onTrigger,
  onEdit,
  onDelete,
  onSelect,
  selectedId,
}: ProvidersTableProps) {
  if (providers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/50 px-6 py-12 text-center">
        <p className="text-sm text-slate-400">Todavía no hay proveedores configurados.</p>
        <p className="mt-1 text-xs text-slate-500">
          Creá uno para que ms-model-api empiece a ingerir series.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700/50">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-800/60 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-4 py-3 font-medium">Proveedor</th>
            <th className="px-4 py-3 font-medium">Tipo</th>
            <th className="px-4 py-3 font-medium">Intervalo</th>
            <th className="px-4 py-3 font-medium">Última ejecución</th>
            <th className="px-4 py-3 font-medium">Estado</th>
            <th className="px-4 py-3 text-right font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {providers.map((provider) => {
            const busy = busyId === provider.id;
            const selected = selectedId === provider.id;

            return (
              <tr
                key={provider.id}
                onClick={() => onSelect(provider)}
                className={`cursor-pointer transition-colors ${
                  selected ? 'bg-slate-800/60' : 'hover:bg-slate-800/30'
                }`}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-100">{provider.name}</div>
                  <div className="font-mono text-xs text-slate-500">{provider.baseUrl}</div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
                      TYPE_BADGE[provider.type] ?? TYPE_BADGE.SFTP_FILE
                    }`}
                  >
                    {TYPE_LABELS[provider.type] ?? provider.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-300">{provider.pollingIntervalMinutes} min</td>
                <td className="px-4 py-3">
                  <RunBadge run={lastRunByProvider[provider.id]} />
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggle(provider);
                    }}
                    disabled={busy}
                    title={provider.isActive ? 'Desactivar (y quitar su cron)' : 'Activar (y registrar su cron)'}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                      provider.isActive
                        ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                        : 'border-slate-600 bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    <Power className="h-3.5 w-3.5" />
                    {provider.isActive ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onTrigger(provider);
                      }}
                      disabled={busy}
                      title="Ejecutar ahora (no cambia el estado)"
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-sky-300 disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(provider);
                      }}
                      title="Editar"
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-100"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(provider);
                      }}
                      title="Eliminar"
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
