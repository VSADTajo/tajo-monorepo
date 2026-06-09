import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { PredictionGroup, PredictionProvider } from '../../types/prediction';
import { LoadingSpinner } from '../ui';
import { getSmcData, getSmcDevices, getWrfData, getEcmwfData } from './api';
import type { PaginationInfo } from './api';
import InputDataDetailModal from './InputDataDetailModal';
import InputDataFilters from './InputDataFilters';
import InputDataTable from './InputDataTable';

const CACHE_MS = 5 * 60 * 1000; // 5 minutes

function defaultSmcStartDate(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
}
function defaultSmcEndDate(): string {
  return new Date().toISOString().slice(0, 16);
}

export default function InputDataPanel() {
  const [search, setSearch] = useState('');
  const [provider, setProvider] = useState<PredictionProvider | 'SMC'>('SMC');
  const [selectedPrediction, setSelectedPrediction] = useState<PredictionGroup | null>(null);
  const [ecmwfEnsemble, setEcmwfEnsemble] = useState<string>('000');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [smcStartDate, setSmcStartDate] = useState(defaultSmcStartDate);
  const [smcEndDate, setSmcEndDate] = useState(defaultSmcEndDate);
  const [smcDeviceId, setSmcDeviceId] = useState('');

  useEffect(() => {
    if (provider !== 'ECMWF') {
      setEcmwfEnsemble('000');
    }
    if (provider === 'SMC') {
      setSmcStartDate((prev) => (prev ? prev : defaultSmcStartDate()));
      setSmcEndDate((prev) => (prev ? prev : defaultSmcEndDate()));
    }
    setPage(1);
  }, [provider]);

  const { data: smcDevicesData } = useQuery({
    queryKey: ['smc-devices'],
    queryFn: getSmcDevices,
    enabled: provider === 'SMC',
    staleTime: CACHE_MS,
  });
  const smcDevices = smcDevicesData?.devices ?? [];

  useEffect(() => {
    if (provider !== 'SMC' || smcDevices.length === 0) return;
    const currentInList = smcDevices.some((d) => d.id === smcDeviceId);
    if (!smcDeviceId || !currentInList) {
      setSmcDeviceId(smcDevices[0].id);
    }
  }, [provider, smcDevices, smcDeviceId]);

  useEffect(() => {
    if (provider === 'SMC') setPage(1);
  }, [smcDeviceId, provider]);

  const subBasinFilter = search.trim() ? search.trim() : undefined;
  const smcStartTs = smcStartDate ? new Date(smcStartDate).getTime() : undefined;
  const smcEndTs = smcEndDate ? new Date(smcEndDate).getTime() : undefined;

  const { data: smcResponse, isLoading: smcLoading, error: smcError } = useQuery({
    queryKey: ['smc-data', page, pageSize, subBasinFilter, smcStartTs, smcEndTs, smcDeviceId],
    queryFn: () =>
      getSmcData(page, pageSize, undefined, subBasinFilter, smcStartTs, smcEndTs, smcDeviceId || undefined),
    enabled: provider === 'SMC' && !!smcDeviceId,
    staleTime: CACHE_MS,
  });

  const { data: wrfResponse, isLoading: wrfLoading, error: wrfError } = useQuery({
    queryKey: ['wrf-data', page, pageSize, subBasinFilter],
    queryFn: () => getWrfData(page, pageSize, undefined, subBasinFilter),
    enabled: provider === 'WRF',
    staleTime: CACHE_MS,
  });

  const { data: ecmwfResponse, isLoading: ecmwfLoading, error: ecmwfError } = useQuery({
    queryKey: ['ecmwf-data', ecmwfEnsemble, page, pageSize, subBasinFilter],
    queryFn: () => getEcmwfData(ecmwfEnsemble, page, pageSize, undefined, subBasinFilter),
    enabled: provider === 'ECMWF',
    staleTime: CACHE_MS,
  });

  const isLoading = smcLoading || wrfLoading || ecmwfLoading;
  const currentResponse = provider === 'SMC' ? smcResponse : provider === 'WRF' ? wrfResponse : ecmwfResponse;
  const currentError = provider === 'SMC' ? smcError : provider === 'WRF' ? wrfError : ecmwfError;
  const hasError = !!currentError;
  const errorMessage = currentError instanceof Error ? currentError.message : 'Failed to fetch data';

  const pagination: PaginationInfo | undefined = currentResponse?.pagination;
  const total = pagination?.total ?? 0;
  const stats = { total, smc: smcResponse?.pagination?.total ?? 0, wrf: wrfResponse?.pagination?.total ?? 0, ecmwf: ecmwfResponse?.pagination?.total ?? 0 };
  const tableData = currentResponse?.data ?? [];

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 p-6">
        <div className="max-w-[1600px] mx-auto space-y-6">
          {/* Header */}
          <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg shadow-purple-500/20">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Forecast Data</h1>
                <p className="text-slate-400 text-sm">Raw prediction data from scheduler and ThingsBoard</p>
              </div>
            </div>

            {/* Statistics */}
            <div className="flex gap-3">
              <div className="text-center px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                <p className="text-2xl font-bold text-slate-100">{stats.total}</p>
                <p className="text-xs text-slate-500 uppercase">Total</p>
              </div>
              <div className="text-center px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-2xl font-bold text-yellow-400">{stats.smc}</p>
                <p className="text-xs text-slate-500 uppercase">Thingsboard Data</p>
              </div>
              <div className="text-center px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <p className="text-2xl font-bold text-emerald-400">{stats.wrf}</p>
                <p className="text-xs text-slate-500 uppercase">WRF</p>
              </div>
              <div className="text-center px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-2xl font-bold text-blue-400">{stats.ecmwf}</p>
                <p className="text-xs text-slate-500 uppercase">ECMWF</p>
              </div>
            </div>
          </header>

          {/* Filters */}
          <InputDataFilters
            search={search}
            provider={provider}
            ecmwfEnsemble={ecmwfEnsemble}
            smcDevices={smcDevices}
            smcDeviceId={smcDeviceId}
            smcStartDate={smcStartDate}
            smcEndDate={smcEndDate}
            onSearchChange={setSearch}
            onProviderChange={setProvider}
            onEcmwfEnsembleChange={setEcmwfEnsemble}
            onSmcDeviceChange={setSmcDeviceId}
            onSmcStartDateChange={setSmcStartDate}
            onSmcEndDateChange={setSmcEndDate}
          />

          {/* Error State */}
          {hasError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="font-semibold text-red-400">Error loading data</h3>
                  <p className="text-red-300/70 text-sm mt-1">{errorMessage}</p>
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <LoadingSpinner message="Loading input data..." size="lg" fullScreen />
          )}

          {!isLoading && !hasError && (
            <InputDataTable
              provider={provider}
              data={tableData}
              pagination={pagination}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          )}

          {/* Detail Modal */}
          {selectedPrediction && (
            <InputDataDetailModal
              prediction={selectedPrediction}
              onClose={() => setSelectedPrediction(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
