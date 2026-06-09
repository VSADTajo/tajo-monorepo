import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PredictionResultResponse } from '../../types/predictions-data';

const PAGE_SIZE_OPTIONS = [50, 100, 200, 500];

interface PredictionResultsTableProps {
  title: string;
  tagClass: string;
  results: PredictionResultResponse[];
  isLoading?: boolean;
}

function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleString(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

const predictionTypeTagClass = 'bg-slate-600/30 text-slate-300 border border-slate-500/30';

export default function PredictionResultsTable({
  title,
  tagClass,
  results,
  isLoading,
}: PredictionResultsTableProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const total = results.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const paginatedRows = useMemo(
    () => results.slice(start, start + pageSize),
    [results, currentPage, pageSize, start]
  );

  useEffect(() => {
    if (page > totalPages && totalPages >= 1) setPage(totalPages);
  }, [totalPages, page]);

  if (isLoading) {
    return (
      <div className={`rounded-xl border overflow-hidden border-slate-700/50 ${tagClass}`}>
        <div className="px-4 py-3 border-b border-slate-700/50 font-semibold text-slate-200">
          {title}
        </div>
        <div className="p-8 text-center text-slate-500">Loading...</div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className={`rounded-xl border overflow-hidden border-slate-700/50 ${tagClass}`}>
        <div className="px-4 py-3 border-b border-slate-700/50 font-semibold text-slate-200">
          {title}
        </div>
        <div className="p-8 text-center text-slate-500">No results</div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border overflow-hidden border-slate-700/50 ${tagClass}`}>
      <div className="px-4 py-3 border-b border-slate-700/50 font-semibold text-slate-200 flex items-center justify-between flex-wrap gap-2">
        <span>{title}</span>
        <span className="text-xs font-normal text-slate-500">{total} rows</span>
      </div>
      <div className="overflow-x-auto bg-slate-800/30">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                date_timestamp
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                prediction_type
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                value
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                sub_basin_name
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {paginatedRows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-700/20 transition-colors">
                <td className="px-4 py-2 text-sm text-slate-400">
                  {formatTimestamp(row.date_timestamp)}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${predictionTypeTagClass}`}
                  >
                    {row.prediction_type ?? '–'}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span className="font-mono text-sm text-slate-200 bg-slate-800/50 px-2 py-0.5 rounded border border-slate-600/50">
                    {row.value}
                  </span>
                </td>
                <td className="px-4 py-2 text-sm font-mono text-slate-400">
                  {row.sub_basin_name ?? '–'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-slate-700/50">
        <div className="flex items-center gap-4">
          <label className="text-sm text-slate-400">
            Page size
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
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
            {total} total · page {currentPage} of {totalPages} · showing {start + 1}–
            {Math.min(start + pageSize, total)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="p-2 rounded-lg bg-slate-700/50 text-slate-400 hover:bg-slate-600/50 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-slate-400">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="p-2 rounded-lg bg-slate-700/50 text-slate-400 hover:bg-slate-600/50 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
