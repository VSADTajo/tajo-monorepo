import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoadingSpinner } from '../ui';
import IOHistoryFilters from './IOHistoryFilters';
import IOHistoryTable from './IOHistoryTable';
import { getIOHistoryFiles, getIOHistoryProviders, downloadIOHistoryFile, getSimulationDates } from './api';
import { IOType, ProviderType, DownloadFormat, IOHistoryFile } from '../../types/io-history';

export default function IOHistoryPanel() {
  const [ioType, setIOType] = useState<IOType>(IOType.INPUT);
  const [provider, setProvider] = useState<ProviderType | 'all'>('all');
  const [simulationDate, setSimulationDate] = useState<string>('');
  const [ensemble, setEnsemble] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [modelFilter, setModelFilter] = useState<string>('');

  // Get available providers
  const { data: providersData } = useQuery({
    queryKey: ['io-history-providers'],
    queryFn: getIOHistoryProviders,
    refetchInterval: 60000,
  });

  // Get available simulation dates
  const { data: datesData } = useQuery({
    queryKey: ['io-history-dates', ioType, provider],
    queryFn: () => getSimulationDates({
      ioType: ioType === IOType.INPUT ? 'input' : 'output',
      provider: provider !== 'all' ? provider : undefined,
    }),
    refetchInterval: 60000,
  });

  const availableDates = datesData?.simulation_dates || [];

  // Pass simulation_environment to the API for server-side filtering
  const { data: filesResponse, isLoading } = useQuery({
    queryKey: ['io-history-files', ioType, provider, simulationDate, ensemble, modelFilter, currentPage, pageSize],
    queryFn: () => getIOHistoryFiles({
      ioType,
      provider: provider !== 'all' ? provider : undefined,
      fromDate: simulationDate || undefined,
      toDate: simulationDate || undefined,
      ensemble: ensemble || undefined,
      simulationEnvironment: modelFilter || undefined,
      page: currentPage,
      pageSize,
    }),
    refetchInterval: 30000,
  });

  const files = filesResponse?.files || [];
  const pagination = filesResponse?.pagination || { page: 1, page_size: 50, total: 0, total_pages: 0 };

  const handleDownload = async (file: IOHistoryFile, format: DownloadFormat) => {
    setDownloadingFile(file.file);
    try {
      const blob = await downloadIOHistoryFile(file.io_type, file.provider, file.file, format);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // ZIP filename: provider_iotype_jobid_simdate.zip
      const downloadFilename = `${file.provider}_${file.io_type}_${file.job_id}_${file.simulation_date}.zip`;

      a.download = downloadFilename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download file');
    } finally {
      setDownloadingFile(null);
    }
  };

  const inputCount = providersData?.input ? Object.values(providersData.input).reduce((sum: number, p: any) => sum + (p.file_count || 0), 0) : 0;
  const outputCount = providersData?.output ? Object.values(providersData.output).reduce((sum: number, p: any) => sum + (p.file_count || 0), 0) : 0;

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 p-6">
        <div className="max-w-[1600px] mx-auto space-y-6">
          {/* Header */}
          <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg shadow-purple-500/20">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Model Files</h1>
                <p className="text-sm text-slate-400">Input/Output files sent and received from the model</p>
              </div>
            </div>
          </header>

          {/* IO Type Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => { setIOType(IOType.INPUT); setCurrentPage(1); setSimulationDate(''); }}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                ioType === IOType.INPUT
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
              Input ({inputCount})
            </button>
            <button
              onClick={() => { setIOType(IOType.OUTPUT); setCurrentPage(1); setSimulationDate(''); }}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                ioType === IOType.OUTPUT
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
              Output ({outputCount})
            </button>
          </div>

          {/* Filters */}
          <IOHistoryFilters
            provider={provider}
            onProviderChange={(p) => { setProvider(p); setCurrentPage(1); setSimulationDate(''); }}
            simulationDate={simulationDate}
            onSimulationDateChange={(d) => { setSimulationDate(d); setCurrentPage(1); }}
            availableDates={availableDates}
            ensemble={ensemble}
            onEnsembleChange={setEnsemble}
            modelFilter={modelFilter}
            onModelFilterChange={(m) => { setModelFilter(m); setCurrentPage(1); }}
          />

          {/* Table */}
          {isLoading ? (
            <LoadingSpinner message="Loading files..." size="lg" />
          ) : (
            <IOHistoryTable
              files={files}
              onDownload={handleDownload}
              downloadingFile={downloadingFile}
              currentPage={pagination.page}
              totalPages={pagination.total_pages}
              totalItems={pagination.total}
              pageSize={pagination.page_size}
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      </div>
    </div>
  );
}
