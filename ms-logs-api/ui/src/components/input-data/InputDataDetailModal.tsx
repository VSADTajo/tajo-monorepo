import { PredictionGroup } from '../../types/prediction';

interface InputDataDetailModalProps {
  prediction: PredictionGroup | null;
  onClose: () => void;
}

export default function InputDataDetailModal({ prediction, onClose }: InputDataDetailModalProps) {
  if (!prediction) return null;

  const providerColors = {
    WRF: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    ECMWF: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  };

  const typeColors = {
    Discharge_forecast: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    Precipitation_forecast: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    Discharge: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    Precipitation: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  };

  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  const formatSimDate = (simDate: string) => {
    if (simDate.length !== 10) return simDate;
    const year = simDate.substring(0, 4);
    const month = simDate.substring(4, 6);
    const day = simDate.substring(6, 8);
    const hour = simDate.substring(8, 10);
    return `${year}-${month}-${day} ${hour}:00`;
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Forecast Data Details</h2>
            <p className="text-purple-100 text-sm mt-1">
              {prediction.station_name} - {prediction.sub_basin_name}
            </p>
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
              <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Provider</p>
              <span className={`inline-block px-3 py-1 rounded-md text-sm font-medium border ${providerColors[prediction.prediction_provider]}`}>
                {prediction.prediction_provider}
              </span>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Type</p>
              <span className={`inline-block px-3 py-1 rounded-md text-sm font-medium border ${typeColors[prediction.prediction_type as keyof typeof typeColors]}`}>
                {prediction.prediction_type.replace('_', ' ')}
              </span>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Ensemble</p>
              <p className="text-sm font-semibold text-slate-200 font-mono">{prediction.ensemble}</p>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Data Points</p>
              <p className="text-sm font-semibold text-slate-200">{prediction.results_count}</p>
            </div>
          </div>

          <div className="mb-6">
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Simulation Date</p>
              <p className="text-sm font-semibold text-slate-200">{formatSimDate(prediction.simulation_date)}</p>
            </div>
          </div>

          {prediction.percentile && (
            <div className="mb-6">
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Percentile</p>
                <p className="text-sm font-semibold text-slate-200">{prediction.percentile}</p>
              </div>
            </div>
          )}

          {/* Results Table */}
          <div>
            <h3 className="text-lg font-semibold text-slate-200 mb-3 flex items-center gap-2">
              Prediction Results
              <span className="text-sm font-normal text-slate-500">({prediction.results_count} points)</span>
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
                        Date & Time
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Value
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        ID
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {prediction.results.map((result, index) => (
                      <tr key={result.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3 text-sm text-slate-500">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-300">
                          {formatDateTime(result.date_timestamp)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-200 text-right font-semibold">
                          {result.value.toFixed(4)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500 font-mono">
                          {result.id}
                        </td>
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
