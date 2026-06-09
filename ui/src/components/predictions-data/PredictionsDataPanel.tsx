import { useQuery } from '@tanstack/react-query';
import { Bot, ChevronDown, Hand, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { HistoricalSimulation } from '../../types/predictions-data';
import { LoadingSpinner } from '../ui';
import PredictionResultsTable from './PredictionResultsTable';
import {
  getHistoricalPredictions,
  getHistoricalSimulations,
  getPredictionResults,
  getStations,
} from './api';

const DROPDOWN_LIST_MAX_HEIGHT = 280;

function isManualSim(sim: { simulation_environment?: string }): boolean {
  return sim.simulation_environment === 'HEC_HMS_MANUAL';
}

function defaultDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return {
    start: start.toISOString().slice(0, 19),
    end: end.toISOString().slice(0, 19),
  };
}

export type ResultType = 'historical' | 'wrf' | 'ecmwf';

const PERCENTILE_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'Determinista' },
  { value: 10, label: '10' },
  { value: 25, label: '25' },
  { value: 50, label: '50' },
  { value: 75, label: '75' },
  { value: 90, label: '90' },
];

export default function PredictionsDataPanel() {
  const defaultRange = useMemo(() => defaultDateRange(), []);
  const [resultType, setResultType] = useState<ResultType>('wrf');
  const [ecmwfPercentile, setEcmwfPercentile] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [selectedSimulationDate, setSelectedSimulationDate] = useState<string>('');
  const [selectedSubBasin, setSelectedSubBasin] = useState<string>('');
  const [simDropdownOpen, setSimDropdownOpen] = useState(false);
  const [stationDropdownOpen, setStationDropdownOpen] = useState(false);
  const [stationSearch, setStationSearch] = useState('');
  const [percentileDropdownOpen, setPercentileDropdownOpen] = useState(false);
  const simDropdownRef = useRef<HTMLDivElement>(null);
  const stationDropdownRef = useRef<HTMLDivElement>(null);
  const percentileDropdownRef = useRef<HTMLDivElement>(null);
  const stationSearchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (simDropdownRef.current && !simDropdownRef.current.contains(e.target as Node))
        setSimDropdownOpen(false);
    };
    if (simDropdownOpen) {
      document.addEventListener('mousedown', onOutside);
      return () => document.removeEventListener('mousedown', onOutside);
    }
  }, [simDropdownOpen]);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (stationDropdownRef.current && !stationDropdownRef.current.contains(e.target as Node))
        setStationDropdownOpen(false);
    };
    if (stationDropdownOpen) {
      document.addEventListener('mousedown', onOutside);
      return () => document.removeEventListener('mousedown', onOutside);
    }
  }, [stationDropdownOpen]);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (percentileDropdownRef.current && !percentileDropdownRef.current.contains(e.target as Node))
        setPercentileDropdownOpen(false);
    };
    if (percentileDropdownOpen) {
      document.addEventListener('mousedown', onOutside);
      return () => document.removeEventListener('mousedown', onOutside);
    }
  }, [percentileDropdownOpen]);

  useEffect(() => {
    if (stationDropdownOpen) {
      setStationSearch('');
      const t = requestAnimationFrame(() => stationSearchInputRef.current?.focus());
      return () => cancelAnimationFrame(t);
    }
  }, [stationDropdownOpen]);

  const { data: simsData, isLoading: loadingSims } = useQuery({
    queryKey: ['predictions-data-simulations', 1, 24],
    queryFn: () => getHistoricalSimulations({ page: 1, page_size: 24 }),
    refetchInterval: 60000,
  });

  const simulations = simsData?.simulations ?? [];
  const latestSimulationDate = simulations[0]?.simulation_date ?? '';

  const { data: stationsRaw = [], isLoading: loadingStations } = useQuery({
    queryKey: ['predictions-data-stations'],
    queryFn: () => getStations(1000),
    refetchInterval: 60000,
  });

  const stations = useMemo(() => {
    const list = stationsRaw.filter(
      (s) => s.sub_basin_name != null && String(s.sub_basin_name).trim() !== ''
    );
    list.sort((a, b) =>
      String(a.sub_basin_name).localeCompare(String(b.sub_basin_name), undefined, { sensitivity: 'base' })
    );
    return list;
  }, [stationsRaw]);

  const firstSubBasin = stations[0]?.sub_basin_name ?? '';
  const effectiveSimulation = selectedSimulationDate || latestSimulationDate;
  const effectiveSubBasin = selectedSubBasin || firstSubBasin;

  const filteredStations = useMemo(() => {
    if (!stationSearch.trim()) return stations;
    const q = stationSearch.trim().toLowerCase();
    return stations.filter(
      (s) =>
        String(s.sub_basin_name).toLowerCase().includes(q) ||
        String(s.name ?? '').toLowerCase().includes(q)
    );
  }, [stations, stationSearch]);

  const selectedSim = simulations.find((s) => s.simulation_date === effectiveSimulation);
  const selectedSimLabel = selectedSim
    ? `${selectedSim.formatted_date ?? selectedSim.simulation_date}${selectedSim.status ? ` (${selectedSim.status})` : ''}`
    : effectiveSimulation || 'Select simulation...';
  const selectedStation = stations.find((s) => s.sub_basin_name === effectiveSubBasin);
  const selectedStationLabel = selectedStation
    ? `${selectedStation.sub_basin_name}${selectedStation.name ? ` — ${selectedStation.name}` : ''}`
    : effectiveSubBasin || 'Select station...';

  const canFetch =
    !!effectiveSimulation && !!effectiveSubBasin && !!startDate && !!endDate;

  const { data: wrfResults = [], isLoading: loadingWrf } = useQuery({
    queryKey: [
      'predictions-data-wrf',
      startDate,
      endDate,
      effectiveSubBasin,
      effectiveSimulation,
    ],
    queryFn: () =>
      getPredictionResults({
        prediction_type: 'Discharge_forecast',
        start_date: startDate,
        end_date: endDate,
        sub_basin_name: effectiveSubBasin,
        prediction_provider: 'WRF',
        simulation_date: effectiveSimulation,
      }),
    enabled: canFetch && resultType === 'wrf',
  });

  const { data: ecmwfResults = [], isLoading: loadingEcmwf } = useQuery({
    queryKey: [
      'predictions-data-ecmwf',
      startDate,
      endDate,
      effectiveSubBasin,
      effectiveSimulation,
      ecmwfPercentile,
    ],
    queryFn: () =>
      getPredictionResults({
        prediction_type: 'Discharge_forecast',
        start_date: startDate,
        end_date: endDate,
        sub_basin_name: effectiveSubBasin,
        prediction_provider: 'ECMWF',
        simulation_date: effectiveSimulation,
        ...(ecmwfPercentile != null && { percentile: ecmwfPercentile }),
      }),
    enabled: canFetch && resultType === 'ecmwf',
  });

  const { data: historicalResults = [], isLoading: loadingHistorical } = useQuery({
    queryKey: [
      'predictions-data-historical',
      startDate,
      endDate,
      effectiveSubBasin,
      effectiveSimulation,
    ],
    queryFn: () =>
      getHistoricalPredictions(
        effectiveSubBasin,
        startDate,
        endDate,
        effectiveSimulation
      ),
    enabled: canFetch && resultType === 'historical',
  });

  if (loadingSims && simulations.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <LoadingSpinner message="Loading simulations..." size="lg" />
      </div>
    );
  }

  if (loadingStations && stations.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <LoadingSpinner message="Loading stations..." size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 p-6">
        <div className="max-w-[1600px] mx-auto space-y-6">
          <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Model Results</h1>
                <p className="text-slate-400 text-sm">
                  Discharge forecast by simulation, station and date range
                </p>
              </div>
            </div>
          </header>

          {/* Result type tabs – como Model Files */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setResultType('historical')}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                resultType === 'historical'
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/30'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
              Historical
            </button>
            <button
              type="button"
              onClick={() => setResultType('wrf')}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                resultType === 'wrf'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
              WRF
            </button>
            <button
              type="button"
              onClick={() => setResultType('ecmwf')}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                resultType === 'ecmwf'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
              ECMWF
            </button>
          </div>

          <div
            className={`bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4 ${simDropdownOpen || stationDropdownOpen || percentileDropdownOpen ? 'relative z-[100]' : ''}`}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              {/* Simulation – mismo estilo que Device (dropdown con botón + chevron) */}
              <div ref={simDropdownRef} className="relative">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Simulation
                </label>
                <button
                  type="button"
                  onClick={() => setSimDropdownOpen((o) => !o)}
                  className="w-full flex items-center gap-2 pl-3 pr-10 py-2.5 min-h-[42px] bg-slate-900/50 border border-slate-700/50 rounded-lg text-left text-slate-200 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 hover:border-slate-600/50 transition-colors"
                >
                  <span className="flex-1 min-w-0 flex items-center gap-2">
                    {selectedSim && (
                      <>
                        {isManualSim(selectedSim) ? (
                          <Hand className="w-4 h-4 text-amber-400 shrink-0" aria-label="Manual" />
                        ) : (
                          <Bot className="w-4 h-4 text-emerald-400 shrink-0" aria-label="Automatic" />
                        )}
                        <span className="truncate">{selectedSimLabel}</span>
                        <span className="text-xs text-slate-500 shrink-0">
                          {isManualSim(selectedSim) ? 'Manual' : 'Automatic'}
                        </span>
                      </>
                    )}
                    {!selectedSim && effectiveSimulation && (
                      <span className="truncate">{selectedSimLabel}</span>
                    )}
                    {!selectedSim && !effectiveSimulation && (
                      <span className="truncate">Select simulation...</span>
                    )}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${simDropdownOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {simDropdownOpen && (
                  <div
                    className="absolute z-50 mt-1 w-full rounded-lg border border-slate-700/50 bg-slate-800 shadow-xl overflow-hidden"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <ul
                      className="overflow-y-auto py-1"
                      style={{ maxHeight: DROPDOWN_LIST_MAX_HEIGHT }}
                    >
                      {simulations.length === 0 ? (
                        <li className="px-3 py-2 text-sm text-slate-500">No simulations</li>
                      ) : (
                        simulations.map((sim: HistoricalSimulation) => (
                          <li key={sim.simulation_date}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSimulationDate(sim.simulation_date);
                                setSimDropdownOpen(false);
                              }}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-700/50 transition-colors flex items-center gap-2 ${
                                sim.simulation_date === effectiveSimulation
                                  ? 'bg-amber-500/20 text-amber-200'
                                  : 'text-slate-200'
                              }`}
                            >
                              {isManualSim(sim) ? (
                                <Hand className="w-4 h-4 text-amber-400 shrink-0" aria-label="Manual" />
                              ) : (
                                <Bot className="w-4 h-4 text-emerald-400 shrink-0" aria-label="Automatic" />
                              )}
                              <span className="flex-1 min-w-0">
                                {sim.formatted_date ?? sim.simulation_date}
                                {sim.status ? ` (${sim.status})` : ''}
                              </span>
                              <span className="text-xs text-slate-500 shrink-0">
                                {isManualSim(sim) ? 'Manual' : 'Automatic'}
                              </span>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                )}
              </div>
              {/* Station – mismo estilo que Device con buscador */}
              <div ref={stationDropdownRef} className="relative">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Station (sub_basin_name)
                </label>
                <button
                  type="button"
                  onClick={() => setStationDropdownOpen((o) => !o)}
                  className="w-full flex items-center gap-2 pl-3 pr-10 py-2.5 min-h-[42px] bg-slate-900/50 border border-slate-700/50 rounded-lg text-left text-slate-200 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 hover:border-slate-600/50 transition-colors"
                >
                  <span className="flex-1 truncate">
                    {selectedStationLabel}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${stationDropdownOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {stationDropdownOpen && (
                  <div
                    className="absolute z-50 mt-1 w-full rounded-lg border border-slate-700/50 bg-slate-800 shadow-xl overflow-hidden"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <div className="p-2 border-b border-slate-700/50 bg-slate-800/80">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                        <input
                          ref={stationSearchInputRef}
                          type="text"
                          placeholder="Buscar estación..."
                          value={stationSearch}
                          onChange={(e) => setStationSearch(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setStationDropdownOpen(false);
                          }}
                          className="w-full pl-8 pr-3 py-2 bg-slate-900/70 border border-slate-600/50 rounded-md text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 text-sm"
                        />
                      </div>
                    </div>
                    <ul
                      className="overflow-y-auto py-1"
                      style={{ maxHeight: DROPDOWN_LIST_MAX_HEIGHT }}
                    >
                      {filteredStations.length === 0 ? (
                        <li className="px-3 py-2 text-sm text-slate-500">No hay estaciones</li>
                      ) : (
                        filteredStations.map((st) => (
                          <li key={String(st.sub_basin_name)}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSubBasin(String(st.sub_basin_name));
                                setStationDropdownOpen(false);
                                setStationSearch('');
                              }}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-700/50 transition-colors ${
                                st.sub_basin_name === effectiveSubBasin
                                  ? 'bg-amber-500/20 text-amber-200'
                                  : 'text-slate-200'
                              }`}
                            >
                              {st.sub_basin_name}
                              {st.name ? ` — ${st.name}` : ''}
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                )}
              </div>
              {/* Percentile – mismo estilo que Simulation/Station, solo cuando ECMWF */}
              {resultType === 'ecmwf' && (
                <div ref={percentileDropdownRef} className="relative">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Percentile
                  </label>
                  <button
                    type="button"
                    onClick={() => setPercentileDropdownOpen((o) => !o)}
                    className="w-full flex items-center gap-2 pl-3 pr-10 py-2.5 min-h-[42px] bg-slate-900/50 border border-slate-700/50 rounded-lg text-left text-slate-200 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 hover:border-slate-600/50 transition-colors"
                  >
                    <span className="flex-1 truncate">
                      {ecmwfPercentile === null
                        ? 'Determinista'
                        : String(ecmwfPercentile)}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${percentileDropdownOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {percentileDropdownOpen && (
                    <div
                      className="absolute z-50 mt-1 w-full rounded-lg border border-slate-700/50 bg-slate-800 shadow-xl overflow-hidden"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <ul
                        className="overflow-y-auto py-1"
                        style={{ maxHeight: DROPDOWN_LIST_MAX_HEIGHT }}
                      >
                        {PERCENTILE_OPTIONS.map((opt) => (
                          <li key={opt.value ?? 'det'}>
                            <button
                              type="button"
                              onClick={() => {
                                setEcmwfPercentile(opt.value);
                                setPercentileDropdownOpen(false);
                              }}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-700/50 transition-colors ${
                                (opt.value === null && ecmwfPercentile === null) ||
                                (opt.value !== null && opt.value === ecmwfPercentile)
                                  ? 'bg-amber-500/20 text-amber-200'
                                  : 'text-slate-200'
                              }`}
                            >
                              {opt.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Start date
                </label>
                <input
                  type="datetime-local"
                  value={startDate.slice(0, 16)}
                  onChange={(e) =>
                    setStartDate((e.target.value || startDate).slice(0, 16) + ':00')
                  }
                  className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  End date
                </label>
                <input
                  type="datetime-local"
                  value={endDate.slice(0, 16)}
                  onChange={(e) =>
                    setEndDate((e.target.value || endDate).slice(0, 16) + ':00')
                  }
                  className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
                />
              </div>
            </div>
          </div>

          {!canFetch ? (
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-12 text-center">
              <p className="text-slate-400">Select a simulation and station to load results.</p>
            </div>
          ) : resultType === 'wrf' ? (
            <PredictionResultsTable
              title="WRF"
              tagClass="border-emerald-500/30 bg-emerald-500/5"
              results={wrfResults}
              isLoading={loadingWrf}
            />
          ) : resultType === 'ecmwf' ? (
            <PredictionResultsTable
              title="ECMWF"
              tagClass="border-blue-500/30 bg-blue-500/5"
              results={ecmwfResults}
              isLoading={loadingEcmwf}
            />
          ) : (
            <PredictionResultsTable
              title="Historical"
              tagClass="border-amber-500/30 bg-amber-500/5"
              results={historicalResults}
              isLoading={loadingHistorical}
            />
          )}
        </div>
      </div>
    </div>
  );
}
