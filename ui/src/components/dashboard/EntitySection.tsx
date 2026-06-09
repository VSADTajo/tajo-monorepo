import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { LogApiResponse, LogLevel } from '../../types/log';
import { getFilteredLogs } from './api';
import Filters from './Filters';
import LogsTable from './LogsTable';

interface EntitySectionProps {
  entity: string;
  globalLevelFilter?: LogLevel | null;
  globalCorrelationId?: string;
  onGlobalLevelClick?: (level: LogLevel) => void;
  onCorrelationIdClick?: (correlationId: string) => void;
}

function transformLog(apiLog: LogApiResponse) {
  return {
    id: apiLog._id,
    entity: apiLog.entity,
    timestamp: apiLog.createdAt,
    level: apiLog.level,
    message: apiLog.message,
    meta: apiLog.meta || undefined,
    filePath: apiLog.filePath || null,
    correlationId: apiLog.correlationId || null,
  };
}

export default function EntitySection({ entity, globalLevelFilter, globalCorrelationId, onGlobalLevelClick, onCorrelationIdClick }: EntitySectionProps) {
  const [filters, setFilters] = useState<{ level: LogLevel | 'ALL'; range: '1h' | '6h' | '24h' | '7d'; search: string; correlationId: string }>({
    level: 'ALL',
    range: '6h',
    search: '',
    correlationId: ''
  });
  const [pageSize, setPageSize] = useState<10 | 50 | 200>(10);
  const [page, setPage] = useState<number>(1);

  const dateRange = useMemo(() => {
    const now = new Date();
    const delta = filters.range === '1h' ? 3600_000
      : filters.range === '6h' ? 6 * 3600_000
      : filters.range === '24h' ? 24 * 3600_000
      : 7 * 24 * 3600_000;
    const dateFrom = new Date(now.getTime() - delta).toISOString();
    const dateTo = now.toISOString();
    return { dateFrom, dateTo };
  }, [filters.range]);

  const activeCorrelationId = filters.correlationId || globalCorrelationId || '';

  const { data: apiLogs = [], isLoading } = useQuery({
    queryKey: ['filteredLogs', entity, filters.level, dateRange.dateFrom, dateRange.dateTo, activeCorrelationId],
    queryFn: () => getFilteredLogs({
      entity,
      level: filters.level === 'ALL' ? undefined : filters.level,
      dateFrom: dateRange.dateFrom,
      dateTo: dateRange.dateTo,
      correlationId: activeCorrelationId || undefined,
    }),
    refetchInterval: 30000,
    staleTime: 0,
    gcTime: 0,
  });

  const rows = useMemo(() => {
    const transformed = apiLogs.map(transformLog);
    if (!filters.search.trim()) return transformed;

    const searchLower = filters.search.toLowerCase();
    return transformed.filter(log => {
      const messageMatch = log.message?.toLowerCase().includes(searchLower) || false;
      const entityMatch = log.entity?.toLowerCase().includes(searchLower) || false;
      const metaMatch = log.meta ? JSON.stringify(log.meta).toLowerCase().includes(searchLower) : false;
      return messageMatch || entityMatch || metaMatch;
    });
  }, [apiLogs, filters.search]);

  useEffect(() => {
    if (globalLevelFilter !== undefined) {
      setFilters(prev => ({ ...prev, level: globalLevelFilter ?? 'ALL' }));
    }
  }, [globalLevelFilter]);

  useEffect(() => {
    if (globalCorrelationId !== undefined) {
      setFilters(prev => ({ ...prev, correlationId: globalCorrelationId }));
    }
  }, [globalCorrelationId]);

  useEffect(() => { setPage(1); }, [filters, pageSize]);

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const pageRows = rows.slice(start, end);

  const entityId = entity || "without-entity";

  return (
    <section className="space-y-4" id={entityId}>
      <div className="bg-slate-800/20 backdrop-blur border border-slate-700/30 rounded-2xl p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full"></div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">{entity || 'Without entity'}</h2>
              <p className="text-xs text-slate-500">Entity logs stream</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {isLoading ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading...
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-2xl font-bold text-slate-100">{total}</div>
                  <div className="text-xs text-slate-500">logs in {filters.range}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <Filters onChange={setFilters} externalLevel={globalLevelFilter} externalCorrelationId={globalCorrelationId} onLevelClick={onGlobalLevelClick} onCorrelationIdClick={onCorrelationIdClick} />

        {isLoading ? (
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-12 text-center">
            <svg className="animate-spin h-8 w-8 mx-auto text-slate-500 mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-slate-400 text-sm">Loading logs...</p>
          </div>
        ) : (
          <LogsTable data={pageRows} onCorrelationIdClick={onCorrelationIdClick} />
        )}

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="text-sm text-slate-400">
            Showing <span className="font-medium text-slate-200">{pageRows.length}</span> of{' '}
            <span className="font-medium text-slate-200">{total}</span> logs
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <select
                className="appearance-none bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 pr-8 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 cursor-pointer"
                value={pageSize}
                onChange={e => setPageSize(Number(e.target.value) as 10 | 50 | 200)}
              >
                <option value={10}>10 / page</option>
                <option value={50}>50 / page</option>
                <option value={200}>200 / page</option>
              </select>
              <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <div className="flex items-center gap-1">
              <button
                className="px-3 py-2 text-sm font-medium text-slate-300 bg-slate-800/50 border border-slate-700/50 rounded-lg hover:bg-slate-700/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="px-3 py-2 text-sm text-slate-400 min-w-[80px] text-center">
                {currentPage} / {totalPages}
              </span>
              <button
                className="px-3 py-2 text-sm font-medium text-slate-300 bg-slate-800/50 border border-slate-700/50 rounded-lg hover:bg-slate-700/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
