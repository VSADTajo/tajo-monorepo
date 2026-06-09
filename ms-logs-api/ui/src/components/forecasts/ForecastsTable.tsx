import { ForecastEntry } from '../../types/forecast';

interface ForecastsTableProps {
  forecasts: ForecastEntry[];
  onViewDetails: (forecast: ForecastEntry) => void;
}

const strategyColors: Record<string, string> = {
  smc: 'bg-purple-500/20 text-purple-400',
  ecmwf: 'bg-blue-500/20 text-blue-400',
  wrf: 'bg-emerald-500/20 text-emerald-400',
};

const jobTypeColors: Record<string, string> = {
  forecast: 'bg-amber-500/20 text-amber-400',
  historical: 'bg-slate-500/20 text-slate-400',
};

const modelColors: Record<string, string> = {
  ecmwf: 'bg-blue-500/20 text-blue-400',
  wrf: 'bg-emerald-500/20 text-emerald-400',
  smc: 'bg-purple-500/20 text-purple-400',
};

function getModelTagClass(model: string | undefined): string {
  if (!model) return 'bg-slate-600/30 text-slate-400';
  const key = model.toLowerCase();
  return modelColors[key] ?? 'bg-slate-600/30 text-slate-400';
}

export default function ForecastsTable({ forecasts, onViewDetails }: ForecastsTableProps) {
  if (forecasts.length === 0) {
    return (
      <div className="text-center py-12 bg-slate-800/30 rounded-xl border border-slate-700/50">
        <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
        <p className="text-slate-400 font-medium">No forecasts found</p>
        <p className="text-slate-500 text-sm mt-1">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Basin</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Strategy</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Model</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Parameter</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Events</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Date Range</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Job ID</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {forecasts.map((forecast) => (
              <tr key={forecast._id} className="hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-700/50 text-slate-200 border border-slate-600/50">
                    {forecast.basin}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${strategyColors[forecast.strategy] ?? 'bg-slate-500/20 text-slate-400'}`}>
                    {forecast.strategy.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${jobTypeColors[forecast.jobType] ?? 'bg-slate-500/20 text-slate-400'}`}>
                    {forecast.jobType}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getModelTagClass(forecast.model)}`}>
                    {forecast.model ? forecast.model.toUpperCase() : '–'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-mono bg-slate-600/30 text-slate-300 border border-slate-500/30">
                    {forecast.parameterId || '–'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
                    {forecast.events.length} events
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="text-xs text-slate-400">
                    {forecast.startDate && forecast.endDate ? (
                      <>
                        <div>{new Date(forecast.startDate).toLocaleDateString()}</div>
                        <div className="text-slate-500">to {new Date(forecast.endDate).toLocaleDateString()}</div>
                      </>
                    ) : (
                      '–'
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded border border-slate-600/50">
                    {forecast.jobId || '–'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onViewDetails(forecast)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
