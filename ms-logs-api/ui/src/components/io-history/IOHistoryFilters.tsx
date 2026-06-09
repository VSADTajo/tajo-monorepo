import { ProviderType } from '../../types/io-history';

interface IOHistoryFiltersProps {
  provider: ProviderType | 'all';
  onProviderChange: (provider: ProviderType | 'all') => void;
  simulationDate: string;
  onSimulationDateChange: (date: string) => void;
  availableDates: string[];
  ensemble: string;
  onEnsembleChange: (ensemble: string) => void;
  modelFilter: string;
  onModelFilterChange: (model: string) => void;
}

// Format simulation date for display: 2026021400 -> 2026-02-14 00:00
function formatSimulationDate(date: string): string {
  if (!date || date.length < 10) return date;
  const year = date.slice(0, 4);
  const month = date.slice(4, 6);
  const day = date.slice(6, 8);
  const hour = date.slice(8, 10);
  return `${year}-${month}-${day} ${hour}:00`;
}

export default function IOHistoryFilters({
  provider,
  onProviderChange,
  simulationDate,
  onSimulationDateChange,
  availableDates,
  ensemble,
  onEnsembleChange,
  modelFilter,
  onModelFilterChange,
}: IOHistoryFiltersProps) {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4">
      <div className="flex flex-wrap gap-4 items-end">
        {/* Provider Filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">Provider</label>
          <select
            value={provider}
            onChange={(e) => onProviderChange(e.target.value as ProviderType | 'all')}
            className="bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          >
            <option value="all">All Providers</option>
            <option value="WRF">WRF</option>
            <option value="ECMWF">ECMWF</option>
            <option value="SMC">SMC</option>
          </select>
        </div>

        {/* Model Filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">Model</label>
          <select
            value={modelFilter}
            onChange={(e) => onModelFilterChange(e.target.value)}
            className="bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          >
            <option value="">All Models</option>
            <option value="HEC_HMS_AUTO">HEC-HMS Auto</option>
            <option value="HEC_HMS_MANUAL">HEC-HMS Manual</option>
            <option value="HEC_HMS_MOCK">HEC-HMS Mock</option>
            <option value="LISFLOOD_AUTO">Lisflood Auto</option>
            <option value="LISFLOOD_MANUAL">Lisflood Manual</option>
          </select>
        </div>

        {/* Simulation Date Filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">Simulation Date</label>
          <select
            value={simulationDate}
            onChange={(e) => onSimulationDateChange(e.target.value)}
            className="bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 min-w-[180px]"
          >
            <option value="">All Dates</option>
            {availableDates.map((date) => (
              <option key={date} value={date}>
                {formatSimulationDate(date)}
              </option>
            ))}
          </select>
        </div>

        {/* Ensemble Filter (only for ECMWF) */}
        {provider === 'ECMWF' && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Ensemble</label>
            <input
              type="text"
              placeholder="e.g., 000"
              value={ensemble}
              onChange={(e) => onEnsembleChange(e.target.value)}
              className="bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 w-24"
            />
          </div>
        )}

        {/* Clear Filters */}
        <button
          onClick={() => {
            onProviderChange('all');
            onSimulationDateChange('');
            onEnsembleChange('');
            onModelFilterChange('');
          }}
          className="px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          Clear Filters
        </button>
      </div>
    </div>
  );
}
