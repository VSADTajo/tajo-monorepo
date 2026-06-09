import { ForecastEntry } from '../../types/forecast';

interface ForecastDetailModalProps {
  forecast: ForecastEntry | null;
  onClose: () => void;
}

export default function ForecastDetailModal({ forecast, onClose }: ForecastDetailModalProps) {
  if (!forecast) return null;

  const strategyColors = {
    smc: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    ecmwf: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    wrf: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  };

  const jobTypeColors = {
    forecast: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    historical: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Forecast Details</h2>
            <p className="text-emerald-100 text-sm mt-1">Basin: {forecast.basin}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Metadata */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Strategy</p>
              <span className={`inline-block px-3 py-1 rounded-md text-sm font-medium border ${strategyColors[forecast.strategy]}`}>
                {forecast.strategy.toUpperCase()}
              </span>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Job Type</p>
              <span className={`inline-block px-3 py-1 rounded-md text-sm font-medium border ${jobTypeColors[forecast.jobType]}`}>
                {forecast.jobType}
              </span>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Model</p>
              <p className="text-sm font-semibold text-slate-200">{forecast.model || '-'}</p>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Events</p>
              <p className="text-sm font-semibold text-slate-200">{forecast.events.length}</p>
            </div>
          </div>

          {forecast.parameterId && (
            <div className="mb-6">
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Parameter</p>
                <p className="text-sm font-semibold text-slate-200">
                  {forecast.parameterId} {forecast.units && `(${forecast.units})`}
                </p>
              </div>
            </div>
          )}

          {forecast.jobId && (
            <div className="mb-6">
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Job ID</p>
                <p className="text-sm font-mono text-slate-200">{forecast.jobId}</p>
              </div>
            </div>
          )}

          {forecast.metadata && Object.keys(forecast.metadata).length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-slate-200 mb-3">Metadata</h3>
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                <pre className="text-xs text-slate-300 whitespace-pre-wrap">
                  {JSON.stringify(forecast.metadata, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Events Table */}
          <div>
            <h3 className="text-lg font-semibold text-slate-200 mb-3 flex items-center gap-2">
              Events
              <span className="text-sm font-normal text-slate-500">({forecast.events.length} total)</span>
            </h3>
            <div className="border border-slate-700/50 rounded-lg overflow-hidden">
              <div className="overflow-x-auto max-h-96">
                <table className="min-w-full">
                  <thead className="bg-slate-800/50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Time
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Value {forecast.units && `(${forecast.units})`}
                      </th>
                      {forecast.events.some(e => e.flag) && (
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Flag
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {forecast.events.map((event, index) => (
                      <tr key={index} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3 text-sm text-slate-500">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-300">
                          {event.date}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-400 font-mono">
                          {event.time}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-200 text-right font-semibold">
                          {event.value.toFixed(2)}
                        </td>
                        {forecast.events.some(e => e.flag) && (
                          <td className="px-4 py-3 text-sm text-slate-400">
                            {event.flag || '-'}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-800/50 px-6 py-4 border-t border-slate-700/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
