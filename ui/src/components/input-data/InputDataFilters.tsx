import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { PredictionProvider } from '../../types/prediction';
import type { SmcDevice } from './api';

const DEBOUNCE_MS = 500;
const DEVICE_LIST_MAX_HEIGHT = 280;

type InputDataProvider = PredictionProvider | 'SMC';

interface InputDataFiltersProps {
  search: string;
  provider: InputDataProvider;
  ecmwfEnsemble: string;
  smcDevices: SmcDevice[];
  smcDeviceId: string;
  smcStartDate: string;
  smcEndDate: string;
  onSearchChange: (value: string) => void;
  onProviderChange: (value: InputDataProvider) => void;
  onEcmwfEnsembleChange: (value: string) => void;
  onSmcDeviceChange: (deviceId: string) => void;
  onSmcStartDateChange: (value: string) => void;
  onSmcEndDateChange: (value: string) => void;
}

export default function InputDataFilters({
  search,
  provider,
  ecmwfEnsemble,
  smcDevices,
  smcDeviceId,
  smcStartDate,
  smcEndDate,
  onSearchChange,
  onProviderChange,
  onEcmwfEnsembleChange,
  onSmcDeviceChange,
  onSmcStartDateChange,
  onSmcEndDateChange,
}: InputDataFiltersProps) {
  const [inputValue, setInputValue] = useState(search);
  const [deviceSearch, setDeviceSearch] = useState('');
  const [deviceDropdownOpen, setDeviceDropdownOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deviceDropdownRef = useRef<HTMLDivElement>(null);
  const deviceSearchInputRef = useRef<HTMLInputElement>(null);

  const sortedFilteredDevices = useMemo(() => {
    const sorted = [...smcDevices].sort((a, b) =>
      (a.label ?? a.name).localeCompare(b.label ?? b.name, undefined, { sensitivity: 'base' })
    );
    if (!deviceSearch.trim()) return sorted;
    const q = deviceSearch.trim().toLowerCase();
    const filtered = sorted.filter(
      (d) =>
        (d.label ?? d.name).toLowerCase().includes(q) ||
        (d.id ?? '').toLowerCase().includes(q)
    );
    if (smcDeviceId && !filtered.some((d) => d.id === smcDeviceId)) {
      const selected = smcDevices.find((d) => d.id === smcDeviceId);
      if (selected) filtered.unshift(selected);
    }
    return filtered;
  }, [smcDevices, deviceSearch, smcDeviceId]);

  useEffect(() => {
    setInputValue(search);
  }, [search]);

  useEffect(() => {
    if (provider !== 'SMC') {
      setDeviceSearch('');
      setDeviceDropdownOpen(false);
    }
  }, [provider]);

  useEffect(() => {
    if (deviceDropdownOpen) {
      setDeviceSearch('');
      const t = requestAnimationFrame(() => deviceSearchInputRef.current?.focus());
      return () => cancelAnimationFrame(t);
    }
  }, [deviceDropdownOpen]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (deviceDropdownRef.current && !deviceDropdownRef.current.contains(e.target as Node)) {
        setDeviceDropdownOpen(false);
      }
    }
    if (deviceDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [deviceDropdownOpen]);

  useEffect(() => {
    if (inputValue === search) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange(inputValue);
      debounceRef.current = null;
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputValue, search]);

  const showEnsembleInput = provider === 'ECMWF';
  const showSmcDateInputs = provider === 'SMC';

  return (
    <div
      className={`bg-slate-800/30 backdrop-blur border border-slate-700/30 rounded-xl p-4 ${deviceDropdownOpen ? 'relative z-[100]' : ''}`}
    >
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        <h3 className="font-semibold text-slate-200">Filters</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Sub basin
          </label>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Filter by sub_basin..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* Provider Filter */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Provider
          </label>
          <div className="relative">
            <select
              value={provider}
              onChange={(e) => onProviderChange(e.target.value as InputDataProvider)}
              className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 appearance-none cursor-pointer"
            >
              <option value="SMC">Thingsboard Data</option>
              <option value="WRF">WRF</option>
              <option value="ECMWF">ECMWF</option>
            </select>
            <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* ECMWF Ensemble Select (000–050) - mismo estilo que Device */}
        {showEnsembleInput && (
          <div className="relative">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              ECMWF Ensemble
            </label>
            <div className="relative w-full flex items-center min-h-[42px] bg-slate-900/50 border border-slate-700/50 rounded-lg focus-within:border-amber-500/50 focus-within:ring-1 focus-within:ring-amber-500/20">
              <select
                value={ecmwfEnsemble}
                onChange={(e) => onEcmwfEnsembleChange(e.target.value)}
                className="w-full pl-3 pr-10 py-2.5 min-h-[42px] bg-transparent border-0 rounded-lg text-slate-200 focus:outline-none focus:ring-0 appearance-none cursor-pointer"
              >
                {Array.from({ length: 51 }, (_, i) => {
                  const value = i.toString().padStart(3, '0');
                  return (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="absolute right-3 w-4 h-4 text-slate-500 pointer-events-none shrink-0" />
            </div>
          </div>
        )}

        {/* Thingsboard Data Device combobox - búsqueda dentro del desplegable */}
        {showSmcDateInputs && (
          <div ref={deviceDropdownRef} className="relative">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Device
            </label>
            <button
              type="button"
              onClick={() => setDeviceDropdownOpen((o) => !o)}
              className="w-full flex items-center gap-2 pl-3 pr-10 py-2.5 min-h-[42px] bg-slate-900/50 border border-slate-700/50 rounded-lg text-left text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 hover:border-slate-600/50 transition-colors"
            >
              <span className="flex-1 truncate">
                {smcDeviceId
                  ? smcDevices.find((d) => d.id === smcDeviceId)?.label ?? smcDevices.find((d) => d.id === smcDeviceId)?.name ?? smcDeviceId
                  : 'Select device...'}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${deviceDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {deviceDropdownOpen && (
              <div
                className="absolute z-50 mt-1 w-full rounded-lg border border-slate-700/50 bg-slate-800 shadow-xl overflow-hidden"
                onMouseDown={(e) => e.preventDefault()}
              >
                <div className="p-2 border-b border-slate-700/50 bg-slate-800/80">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    <input
                      ref={deviceSearchInputRef}
                      type="text"
                      placeholder="Buscar dispositivo..."
                      value={deviceSearch}
                      onChange={(e) => setDeviceSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setDeviceDropdownOpen(false);
                      }}
                      className="w-full pl-8 pr-3 py-2 bg-slate-900/70 border border-slate-600/50 rounded-md text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 text-sm"
                    />
                  </div>
                </div>
                <ul
                  className="overflow-y-auto py-1"
                  style={{ maxHeight: DEVICE_LIST_MAX_HEIGHT }}
                >
                  {sortedFilteredDevices.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-slate-500">No hay dispositivos</li>
                  ) : (
                    sortedFilteredDevices.map((d) => (
                      <li key={d.id}>
                        <button
                          type="button"
                          onClick={() => {
                            onSmcDeviceChange(d.id);
                            setDeviceDropdownOpen(false);
                            setDeviceSearch('');
                          }}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-700/50 transition-colors ${
                            d.id === smcDeviceId ? 'bg-amber-500/20 text-amber-200' : 'text-slate-200'
                          }`}
                        >
                          {d.label ?? d.name}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Thingsboard Data Start / End date - Solo visible cuando provider === 'SMC' */}
        {showSmcDateInputs && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Start date
              </label>
              <input
                type="datetime-local"
                value={smcStartDate}
                onChange={(e) => onSmcStartDateChange(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                End date
              </label>
              <input
                type="datetime-local"
                value={smcEndDate}
                onChange={(e) => onSmcEndDateChange(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
