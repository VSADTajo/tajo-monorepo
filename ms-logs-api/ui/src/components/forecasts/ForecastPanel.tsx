import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getForecastsFiltered, getTotalCount, getAllBasins, getAllSimulationDates, getAllEnsembles } from './api';
import ForecastFilters from './ForecastFilters';
import ForecastsTable from './ForecastsTable';
import ForecastDetailModal from './ForecastDetailModal';
import { StrategyType, JobType, ForecastEntry } from '../../types/forecast';
import { LoadingSpinner } from '../ui';

export default function ForecastPanel() {
  const [search, setSearch] = useState('');
  const [strategy, setStrategy] = useState<StrategyType | 'all'>('all');
  const [jobType, setJobType] = useState<JobType | 'all'>('all');
  const [simulationDate, setSimulationDate] = useState<string>('all');
  const [ensemble, setEnsemble] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedForecast, setSelectedForecast] = useState<ForecastEntry | null>(null);

  // Get available simulation dates first
  const { data: availableSimulationDates = [], isLoading: isLoadingDates } = useQuery({
    queryKey: ['forecasts-simulation-dates'],
    queryFn: getAllSimulationDates,
    refetchInterval: 30000,
  });

  // Get available ensembles
  const { data: availableEnsembles = [] } = useQuery({
    queryKey: ['forecasts-ensembles'],
    queryFn: getAllEnsembles,
    refetchInterval: 30000,
  });

  // Only fetch forecasts when a simulation date is selected
  const { data: forecasts = [], isLoading: isLoadingForecasts } = useQuery({
    queryKey: ['forecasts', simulationDate, strategy, jobType, ensemble],
    queryFn: () => getForecastsFiltered({
      simulationHour: simulationDate !== 'all' ? simulationDate : undefined,
      strategy: strategy !== 'all' ? strategy : undefined,
      jobType: jobType !== 'all' ? jobType : undefined,
      ensemble: ensemble !== 'all' ? ensemble : undefined,
    }),
    enabled: simulationDate !== 'all', // Only run when a simulation date is selected
    refetchInterval: 30000,
  });

  const { data: totalCount = 0 } = useQuery({
    queryKey: ['forecasts-count'],
    queryFn: getTotalCount,
    refetchInterval: 30000,
  });

  const { data: basins = [] } = useQuery({
    queryKey: ['forecasts-basins'],
    queryFn: getAllBasins,
    refetchInterval: 30000,
  });

  // Only filter by search text on frontend (other filters are applied in backend)
  const filteredForecasts = useMemo(() => {
    let result = [...forecasts];
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (f) =>
          f.basin.toLowerCase().includes(searchLower) ||
          f.jobId?.toLowerCase().includes(searchLower) ||
          f.model?.toLowerCase().includes(searchLower)
      );
    }
    return result;
  }, [forecasts, search]);

  const paginatedForecasts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredForecasts.slice(startIndex, endIndex);
  }, [filteredForecasts, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredForecasts.length / pageSize);

  if (isLoadingDates) {
    return <LoadingSpinner message="Loading simulation dates..." size="lg" fullScreen />;
  }

  const isLoading = isLoadingForecasts;

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 p-6">
        <div className="max-w-[1600px] mx-auto space-y-6">
          {/* Header */}
          <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/20">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Forecasts Dashboard</h1>
                <p className="text-slate-400 text-sm">Monitor model input data</p>
              </div>
            </div>

            {/* Statistics */}
            <div className="flex gap-3">
              <div className="text-center px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                <p className="text-2xl font-bold text-slate-100">{totalCount}</p>
                <p className="text-xs text-slate-500 uppercase">Total</p>
              </div>
              <div className="text-center px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-2xl font-bold text-blue-400">{filteredForecasts.length}</p>
                <p className="text-xs text-slate-500 uppercase">Filtered</p>
              </div>
            </div>
          </header>

          {/* Basins Quick Stats */}
          <div className="bg-slate-800/30 backdrop-blur border border-slate-700/30 rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-400 font-medium">Basins:</span>
              {basins.slice(0, 10).map((basin) => (
                <span
                  key={basin}
                  className="px-3 py-1 bg-slate-700/50 rounded-full text-xs font-medium text-slate-300 border border-slate-600/50"
                >
                  {basin}
                </span>
              ))}
              {basins.length > 10 && (
                <span className="px-3 py-1 bg-blue-500/20 rounded-full text-xs font-medium text-blue-400 border border-blue-500/30">
                  +{basins.length - 10} more
                </span>
              )}
            </div>
          </div>

          {/* Filters */}
          <ForecastFilters
            search={search}
            strategy={strategy}
            jobType={jobType}
            simulationDate={simulationDate}
            ensemble={ensemble}
            availableSimulationDates={availableSimulationDates}
            availableEnsembles={availableEnsembles}
            onSearchChange={(value) => {
              setSearch(value);
              setCurrentPage(1);
            }}
            onStrategyChange={(value) => {
              setStrategy(value);
              setCurrentPage(1);
            }}
            onJobTypeChange={(value) => {
              setJobType(value);
              setCurrentPage(1);
            }}
            onSimulationDateChange={(value) => {
              setSimulationDate(value);
              setCurrentPage(1);
            }}
            onEnsembleChange={(value) => {
              setEnsemble(value);
              setCurrentPage(1);
            }}
          />

          {/* Table */}
          {simulationDate === 'all' ? (
            <div className="bg-slate-800/30 backdrop-blur border border-slate-700/30 rounded-xl p-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <svg className="w-16 h-16 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div>
                  <h3 className="text-xl font-semibold text-slate-300 mb-2">Select a Simulation Date</h3>
                  <p className="text-slate-500">Please select a simulation date from the filter above to view forecasts.</p>
                </div>
              </div>
            </div>
          ) : isLoading ? (
            <div className="bg-slate-800/30 backdrop-blur border border-slate-700/30 rounded-xl p-12 text-center">
              <LoadingSpinner message="Loading forecasts..." size="lg" />
            </div>
          ) : (
            <ForecastsTable
              forecasts={paginatedForecasts}
              onViewDetails={setSelectedForecast}
            />
          )}

          {/* Pagination */}
          {simulationDate !== 'all' && totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-800/30 backdrop-blur border border-slate-700/30 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-400">Show:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-3 py-1.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                >
                  <option value={10}>10</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
                <span className="text-sm text-slate-400">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredForecasts.length)} of {filteredForecasts.length}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-slate-800/50 text-slate-300 rounded-lg border border-slate-700/50 hover:bg-slate-700/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-sm text-slate-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-slate-800/50 text-slate-300 rounded-lg border border-slate-700/50 hover:bg-slate-700/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Detail Modal */}
          <ForecastDetailModal
            forecast={selectedForecast}
            onClose={() => setSelectedForecast(null)}
          />
        </div>
      </div>
    </div>
  );
}
