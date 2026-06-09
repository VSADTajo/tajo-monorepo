import { useState } from 'react';
import type { LogEntry } from '../../types/log';
import LogDetailModal from './LogDetailModal';

interface LogsTableProps {
  data: LogEntry[];
  onCorrelationIdClick?: (correlationId: string) => void;
}

const handleDownload = async (filePath: string) => {
  const apiUrl = import.meta.env.VITE_API_URL;

  if (!apiUrl) {
    console.error('VITE_API_URL is not configured');
    return;
  }

  const url = `${apiUrl}${filePath}`;

  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filePath.split('/').pop() || 'file';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    console.error('Error downloading file:', error);
  }
};

const levelConfig: Record<LogEntry['level'], { bg: string; text: string; dot: string; border: string }> = {
  info: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    dot: 'bg-blue-400',
    border: 'border-blue-500/30',
  },
  warning: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
    border: 'border-amber-500/30',
  },
  error: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    dot: 'bg-rose-400',
    border: 'border-rose-500/30',
  },
};

function LogRow({ log, isExpanded, onToggle, onMessageClick, onCorrelationIdClick }: { log: LogEntry; isExpanded: boolean; onToggle: () => void; onMessageClick: (log: LogEntry) => void; onCorrelationIdClick?: (correlationId: string) => void }) {
  const config = levelConfig[log.level];
  const hasDetails = log.meta || log.filePath;

  return (
    <>
      <tr
        className={`border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer transition-colors ${
          isExpanded ? 'bg-slate-700/20' : ''
        }`}
        onClick={onToggle}
      >
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${config.dot}`}></span>
            <span className="text-xs text-slate-400 font-mono">
              {new Date(log.timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
              })}
            </span>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md ${config.bg} ${config.text} border ${config.border}`}>
            {log.level}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className="text-xs font-medium text-slate-300 bg-slate-700/50 px-2 py-1 rounded">
            {log.entity}
          </span>
        </td>
        <td className="px-4 py-3">
          {log.correlationId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCorrelationIdClick?.(log.correlationId!);
              }}
              className="text-xs font-mono text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 px-2 py-0.5 rounded transition-colors truncate max-w-[120px] block"
              title={`Filter by Trace ID: ${log.correlationId}`}
            >
              {log.correlationId.length > 12 ? `${log.correlationId.slice(0, 12)}...` : log.correlationId}
            </button>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-slate-300 max-w-md">
          <div
            className="truncate hover:text-blue-400 cursor-pointer transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onMessageClick(log);
            }}
            title="Click to view full message"
          >
            {log.message}
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          {hasDetails && (
            <svg
              className={`w-4 h-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </td>
      </tr>
      {isExpanded && hasDetails && (
        <tr className="bg-slate-800/50">
          <td colSpan={6} className="px-4 py-4">
            <div className="space-y-3 ml-6">
              {log.meta && (
                <div>
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Metadata</span>
                  <pre className="mt-1 p-3 bg-slate-900/50 rounded-lg text-xs text-slate-300 overflow-x-auto border border-slate-700/50">
                    {JSON.stringify(log.meta, null, 2)}
                  </pre>
                </div>
              )}
              {log.filePath && (
                <div>
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Attachment</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(log.filePath!);
                    }}
                    className="mt-1 flex items-center gap-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400 text-sm transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {log.filePath.split('/').pop()}
                  </button>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function LogsTable({ data, onCorrelationIdClick }: LogsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <>
      <div className="bg-slate-800/30 backdrop-blur border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
          <table className="min-w-full">
            <thead className="sticky top-0 z-10 bg-slate-800/95 backdrop-blur border-b border-slate-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-32">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-24">
                  Level
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-40">
                  Entity
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-36">
                  Trace ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Message
                </th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {data.map(log => (
                <LogRow
                  key={log.id}
                  log={log}
                  isExpanded={expandedRows.has(log.id)}
                  onToggle={() => toggleRow(log.id)}
                  onMessageClick={setSelectedLog}
                  onCorrelationIdClick={onCorrelationIdClick}
                />
              ))}
            </tbody>
          </table>
        </div>
        {data.length === 0 && (
          <div className="p-8 text-center">
            <svg className="w-12 h-12 mx-auto text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-slate-500 text-sm">No logs found</p>
            <p className="text-slate-600 text-xs mt-1">Try adjusting your filters</p>
          </div>
        )}
      </div>
      <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
    </>
  );
}
