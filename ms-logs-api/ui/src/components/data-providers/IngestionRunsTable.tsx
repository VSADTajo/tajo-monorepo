import type { IngestionRun } from './types';

interface IngestionRunsTableProps {
  runs: IngestionRun[];
  providerName: string;
}

const STATUS_TONE: Record<string, string> = {
  SUCCESS: 'text-emerald-300',
  RUNNING: 'text-sky-300',
  PARTIAL: 'text-amber-300',
  FAILED: 'text-red-300',
};

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('es-ES');
}

function duration(run: IngestionRun): string {
  if (!run.completedAt) return '—';
  const ms = new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export default function IngestionRunsTable({ runs, providerName }: IngestionRunsTableProps) {
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/50">
      <div className="border-b border-slate-700/50 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-200">Ejecuciones de {providerName}</h3>
        <p className="text-xs text-slate-500">
          Una fila por corrida. Series y eventos son lo que se publicó en{' '}
          <code className="text-slate-400">timeseries.ingested</code>.
        </p>
      </div>

      {runs.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-500">
          Este proveedor todavía no se ejecutó.
        </p>
      ) : (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-800/80 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">Inicio</th>
                <th className="px-4 py-2 font-medium">Estado</th>
                <th className="px-4 py-2 font-medium">Series</th>
                <th className="px-4 py-2 font-medium">Eventos</th>
                <th className="px-4 py-2 font-medium">Duración</th>
                <th className="px-4 py-2 font-medium">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {runs.map((run) => (
                <tr key={run.id}>
                  <td className="px-4 py-2 text-slate-300">{formatDate(run.startedAt)}</td>
                  <td className={`px-4 py-2 font-medium ${STATUS_TONE[run.status] ?? 'text-slate-300'}`}>
                    {run.status}
                  </td>
                  <td className="px-4 py-2 text-slate-300">{run.seriesCount.toLocaleString('es-ES')}</td>
                  <td className="px-4 py-2 text-slate-300">{run.eventsCount.toLocaleString('es-ES')}</td>
                  <td className="px-4 py-2 text-slate-400">{duration(run)}</td>
                  <td className="px-4 py-2 text-xs text-red-300">{run.errorMessage ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
