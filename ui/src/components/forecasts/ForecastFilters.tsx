import { StrategyType, JobType } from '../../types/forecast';

interface ForecastFiltersProps {
  search: string;
  strategy: StrategyType | 'all';
  jobType: JobType | 'all';
  simulationDate: string;
  ensemble: string;
  availableSimulationDates: string[];
  availableEnsembles: string[];
  onSearchChange: (value: string) => void;
  onStrategyChange: (value: StrategyType | 'all') => void;
  onJobTypeChange: (value: JobType | 'all') => void;
  onSimulationDateChange: (value: string) => void;
  onEnsembleChange: (value: string) => void;
}

export default function ForecastFilters({
  search,
  strategy,
  jobType,
  simulationDate,
  ensemble,
  availableSimulationDates,
  availableEnsembles,
  onSearchChange,
  onStrategyChange,
  onJobTypeChange,
  onSimulationDateChange,
  onEnsembleChange,
}: ForecastFiltersProps) {
  return (
    <div className="bg-slate-800/30 backdrop-blur border border-slate-700/30 rounded-xl p-4 space-y-4">
      <div className="flex flex-wrap gap-4">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by basin, job ID..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* Strategy Filter */}
        <div className="min-w-[150px]">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <select
              value={strategy}
              onChange={(e) => onStrategyChange(e.target.value as StrategyType | 'all')}
              className="w-full pl-10 pr-10 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 appearance-none cursor-pointer"
            >
              <option value="all">All Strategies</option>
              <option value="smc">SMC</option>
              <option value="ecmwf">ECMWF</option>
              <option value="wrf">WRF</option>
            </select>
            <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Job Type Filter */}
        <div className="min-w-[150px]">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <select
              value={jobType}
              onChange={(e) => onJobTypeChange(e.target.value as JobType | 'all')}
              className="w-full pl-10 pr-10 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 appearance-none cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="forecast">Forecast</option>
              <option value="historical">Historical</option>
            </select>
            <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Simulation Date and Ensemble Filters Row */}
      <div className="flex flex-wrap gap-4">
        {/* Simulation Date Filter */}
        {availableSimulationDates.length > 0 && (
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
              Simulation Date
            </label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <select
                value={simulationDate}
                onChange={(e) => onSimulationDateChange(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 appearance-none cursor-pointer"
              >
                <option value="all">All Simulation Dates</option>
                {availableSimulationDates.map((date) => (
                  <option key={date} value={date}>
                    {date}
                  </option>
                ))}
              </select>
              <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        )}

        {/* Ensemble Filter */}
        {availableEnsembles.length > 0 && (
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
              Ensemble
            </label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <select
                value={ensemble}
                onChange={(e) => onEnsembleChange(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 appearance-none cursor-pointer"
              >
                <option value="all">All Ensembles</option>
                {availableEnsembles.map((ens) => (
                  <option key={ens} value={ens}>
                    Ensemble {ens}
                  </option>
                ))}
              </select>
              <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
