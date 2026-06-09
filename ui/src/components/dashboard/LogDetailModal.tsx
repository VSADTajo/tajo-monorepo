import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { LogEntry } from '../../types/log';

interface LogDetailModalProps {
  log: LogEntry | null;
  onClose: () => void;
}

const levelConfig = {
  info: {
    gradient: 'from-blue-600 to-cyan-600',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
  },
  warning: {
    gradient: 'from-amber-600 to-orange-600',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
  },
  error: {
    gradient: 'from-rose-600 to-red-600',
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
  },
};

export default function LogDetailModal({ log, onClose }: LogDetailModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!log) return null;

  const config = levelConfig[log.level];

  return createPortal(
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`bg-gradient-to-r ${config.gradient} px-6 py-4 flex items-center justify-between`}>
          <div>
            <h2 className="text-lg font-bold text-white">Log Detail</h2>
            <p className="text-white/70 text-sm mt-0.5">
              {log.entity} &middot; {log.level.toUpperCase()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-5">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Timestamp</p>
              <p className="text-sm font-medium text-slate-200">
                {new Date(log.timestamp).toLocaleString()}
              </p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Level</p>
              <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-medium border ${config.bg} ${config.text} ${config.border}`}>
                {log.level.toUpperCase()}
              </span>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Service</p>
              <p className="text-sm font-medium text-slate-200">{log.entity}</p>
            </div>
            {log.correlationId && (
              <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Trace ID</p>
                <p className="text-sm font-medium text-slate-200 font-mono">{log.correlationId}</p>
              </div>
            )}
          </div>

          {/* Full message */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Message</h3>
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
              <p className="text-sm text-slate-300 whitespace-pre-wrap break-words leading-relaxed">
                {log.message}
              </p>
            </div>
          </div>

          {/* Metadata */}
          {log.meta && Object.keys(log.meta).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-2">Metadata</h3>
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                <pre className="text-xs text-slate-300 whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(log.meta, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Attachment */}
          {log.filePath && (
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-2">Attachment</h3>
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                <p className="text-sm text-slate-400 font-mono">{log.filePath}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-800/50 px-6 py-3 border-t border-slate-700/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
