import type { PaginationInfo, PredictionDataPoint, SmcDataPoint } from './api';

type InputDataProvider = 'SMC' | 'WRF' | 'ECMWF';

interface InputDataTableProps {
  provider: InputDataProvider;
  data: (PredictionDataPoint | SmcDataPoint)[];
  pagination?: PaginationInfo;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

const PAGE_SIZE_OPTIONS = [10, 50, 100];

const providerTagClass: Record<string, string> = {
  WRF: 'bg-emerald-500/20 text-emerald-400',
  ECMWF: 'bg-blue-500/20 text-blue-400',
};

function formatTimestamp(ts: number, isSeconds = true) {
  const ms = isSeconds ? ts * 1000 : ts;
  return new Date(ms).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

function formatSimDate(simDate: string) {
  if (!simDate || simDate.length < 10) return simDate;
  const y = simDate.slice(0, 4);
  const m = simDate.slice(4, 6);
  const d = simDate.slice(6, 8);
  const h = simDate.length >= 10 ? simDate.slice(8, 10) : '00';
  return `${y}-${m}-${d} ${h}:00`;
}

export default function InputDataTable({
  provider,
  data,
  pagination,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: InputDataTableProps) {
  if (data.length === 0 && !pagination?.total) {
    return (
      <div className="text-center py-12 bg-slate-800/30 rounded-xl border border-slate-700/50">
        <p className="text-slate-400 font-medium">No data</p>
        <p className="text-slate-500 text-sm mt-1">Try another provider or sub basin</p>
      </div>
    );
  }

  const page = pagination?.page ?? 1;
  const totalPages = pagination?.totalPages ?? 0;
  const total = pagination?.total ?? 0;

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center gap-4">
          <label className="text-sm text-slate-400">
            Page size
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="ml-2 rounded bg-slate-900/80 border border-slate-600 text-slate-200 px-2 py-1 text-sm"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <span className="text-sm text-slate-500">
            {total} total · page {page} of {totalPages || 1}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg bg-slate-700/50 text-slate-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600/50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg bg-slate-700/50 text-slate-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600/50"
          >
            Next
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50">
              {provider === 'SMC' ? (
                <>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">device_name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">device_type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">station_name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">sub_basin_name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">sensor_name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">value</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">units</th>
                </>
              ) : (
                <>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">station_name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">sub_basin_name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">prediction_provider</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">ensemble</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">simulation_date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">prediction_type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">date_timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">value</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {provider === 'SMC'
              ? (data as SmcDataPoint[]).map((row, i) => (
                  <tr key={`${row.device_id}-${row.timestamp}-${i}`} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-700/50 text-slate-200 border border-slate-600/50">
                        {row.device_name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-400">
                        {row.device_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-200">{row.station_name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-mono bg-slate-700/50 text-slate-300 border border-slate-600/50">
                        {row.sub_basin_name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400">
                        {row.sensor_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">{formatTimestamp(row.timestamp, false)}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-slate-200 bg-slate-800/50 px-2 py-1 rounded border border-slate-600/50">
                        {row.value}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">{row.units}</td>
                  </tr>
                ))
              : (data as PredictionDataPoint[]).map((row, i) => (
                  <tr key={`${row.id}-${i}`} className="hover:bg-slate-700/20">
                    <td className="px-4 py-2 text-sm text-slate-200">{row.station_name}</td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-mono bg-slate-700/50 text-slate-300 border border-slate-600/50">
                        {row.sub_basin_name}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${providerTagClass[row.prediction_provider] ?? 'bg-slate-500/20 text-slate-400'}`}>
                        {row.prediction_provider}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-mono bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        {row.ensemble}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-300">{formatSimDate(row.simulation_date)}</td>
                    <td className="px-4 py-2 text-sm text-slate-300">{row.prediction_type}</td>
                    <td className="px-4 py-2 text-sm text-slate-400">{formatTimestamp(row.date_timestamp)}</td>
                    <td className="px-4 py-2 text-sm text-slate-200">{row.value}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
