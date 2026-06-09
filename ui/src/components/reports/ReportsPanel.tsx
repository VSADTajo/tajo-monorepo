import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FilePlus, FileText, Loader2, RefreshCcw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ExportFile } from '../../types/exports';
import type { ReportFile } from '../../types/reports';
import { getHistoricalSimulations } from '../predictions-data/api';
import { LoadingSpinner } from '../ui';
import { deleteReport, downloadReport, generateReport, getReports } from './api';
import { ExportCsvModal } from './ExportCsvModal';
import { downloadExportFile, getExportsFiles } from './exports-api';

const PAGE_SIZE = 10;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleString();
  } catch {
    return dateStr;
  }
}

/** Simulation date from historical API may be 14 digits; scheduler expects YYYYMMDDHH (10). */
function toSchedulerSimulationDate(s: string): string {
  return s.length >= 10 ? s.slice(0, 10) : s;
}

type ReportTab = 'dat' | 'csv';

export default function ReportsPanel() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ReportTab>('dat');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [fileToDelete, setFileToDelete] = useState<ReportFile | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [provider, setProvider] = useState<'WRF' | 'ECMWF'>('WRF');
  const [simulationDate, setSimulationDate] = useState<string>('');
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvDownloading, setCsvDownloading] = useState<string | null>(null);

  const { data: simsData } = useQuery({
    queryKey: ['reports-simulations-finalized'],
    queryFn: () =>
      getHistoricalSimulations({
        simulation_environment: 'HEC_HMS_AUTO',
        page: 1,
        page_size: 24,
        only_unarchived_maneuvers: false,
      }),
    staleTime: 60000,
  });
  const finalizedSimulations =
    simsData?.simulations?.filter((s) => s.status === 'finalized') ?? [];
  const latestSimulationDate: string | undefined = simsData?.simulations?.[0]?.simulation_date;

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: [
      'reports',
      provider,
      simulationDate,
      currentPage,
    ],
    queryFn: () =>
      getReports({
        provider,
        simulation_date: simulationDate ? toSchedulerSimulationDate(simulationDate) : undefined,
        limit: PAGE_SIZE,
        offset: (currentPage - 1) * PAGE_SIZE,
      }),
    refetchInterval: 60000,
  });

  const files: ReportFile[] = data?.files ?? [];
  const totalCount = data?.total_count ?? 0;
  const totalPages = totalCount === 0 ? 1 : Math.ceil(totalCount / PAGE_SIZE);
  const safePage = Math.min(currentPage, totalPages);

  const { data: exportsData, isLoading: exportsLoading, isError: exportsError, refetch: refetchExports } = useQuery({
    queryKey: ['exports-files'],
    queryFn: getExportsFiles,
    staleTime: 30000,
  });
  const csvFiles: ExportFile[] = exportsData?.files ?? [];

  const generateMutation = useMutation({
    mutationFn: () => generateReport({ force: false }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['reports'] });
      setToastMessage('The report generation has started. In a few minutes it will appear in the Reports list.');
    },
    onError: (error) => {
      console.error('Generate report failed:', error);
      alert('Failed to generate report');
    },
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [provider, simulationDate]);

  useEffect(() => {
    if (!toastMessage) return;
    const id = setTimeout(() => setToastMessage(null), 5000);
    return () => clearTimeout(id);
  }, [toastMessage]);

  const handleDownload = async (file: ReportFile) => {
    setDownloading(file.filename);
    try {
      const blob = await downloadReport(file.filename);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download report');
    } finally {
      setDownloading(null);
    }
  };

  const openDeleteConfirm = (file: ReportFile) => setFileToDelete(file);
  const closeDeleteConfirm = () => setFileToDelete(null);

  const handleDeleteConfirm = async () => {
    if (!fileToDelete) return;
    setDeleting(fileToDelete.filename);
    closeDeleteConfirm();
    try {
      await deleteReport(fileToDelete.filename);
      await queryClient.invalidateQueries({ queryKey: ['reports'] });
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete report');
    } finally {
      setDeleting(null);
    }
  };

  const handleCsvDownload = async (file: ExportFile) => {
    setCsvDownloading(file.filename);
    try {
      const blob = await downloadExportFile(file.filename);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('CSV download failed:', error);
      alert('Failed to download CSV');
    } finally {
      setCsvDownloading(null);
    }
  };

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
                <FileText className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Model Reports</h1>
                <p className="text-sm text-slate-400">
                  .dat reports from the scheduler and CSV exports from predictions.
                </p>
              </div>
            </div>
          </header>

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl bg-slate-800/50 border border-slate-700/50 w-fit">
            <button
              type="button"
              onClick={() => setActiveTab('dat')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'dat'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Model Reports .dat
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('csv')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'csv'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Model Reports CSV
            </button>
          </div>

          {/* Tab: Model Reports .dat */}
          {activeTab === 'dat' && (
            <>
          {/* Generate report card */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center gap-2 mb-4">
              <FilePlus className="w-5 h-5 text-slate-400" />
              <h3 className="font-semibold text-slate-200">Generate report</h3>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-200">Generate new report</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  You will generate a WRF and ECMWF report for the latest simulation
                  {latestSimulationDate ? ` (${latestSimulationDate})` : ''}.
                </p>
              </div>
              <button
              type="button"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all bg-emerald-600 text-white shadow shadow-emerald-600/30 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 w-fit"
            >
              {generateMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FilePlus className="w-3.5 h-3.5" />
              )}
              <span>Generate report</span>
            </button>
            </div>
          </div>

          {/* Filters card */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <h3 className="font-semibold text-slate-200">Filters</h3>
            </div>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Provider</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as 'WRF' | 'ECMWF')}
                  className="w-full min-w-[120px] px-3 py-2.5 rounded-lg bg-slate-900/50 border border-slate-700/50 text-slate-200 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
                >
                  <option value="WRF">WRF</option>
                  <option value="ECMWF">ECMWF</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Simulation date</label>
                <select
                  value={simulationDate}
                  onChange={(e) => setSimulationDate(e.target.value)}
                  className="w-full min-w-[180px] px-3 py-2.5 rounded-lg bg-slate-900/50 border border-slate-700/50 text-slate-200 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
                >
                  <option value="">All</option>
                  {finalizedSimulations.map((s) => (
                    <option key={s.simulation_date} value={s.simulation_date}>
                      {s.formatted_date ?? s.simulation_date}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <LoadingSpinner message="Loading reports..." size="lg" />
          ) : isError ? (
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-red-500/40 p-6">
              <p className="text-sm text-red-300">
                Failed to load reports. Please try again later.
              </p>
            </div>
          ) : files.length === 0 ? (
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-12 text-center">
              <p className="text-slate-400">No reports generated yet</p>
            </div>
          ) : (
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
              <div className="flex items-center justify-end px-4 py-2 border-b border-slate-700/50 bg-slate-800/70">
                <button
                  type="button"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-600/70 text-xs text-slate-200 hover:bg-slate-700/70 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCcw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        File
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Size
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Modified
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {files.map((file) => (
                      <tr key={file.filename} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-slate-400" />
                            <span className="text-sm text-slate-100 font-mono truncate max-w-[360px]" title={file.filename}>
                              {file.filename}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-300">
                          {formatBytes(file.size)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-300">
                          {formatDate(file.modified_at_iso)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleDownload(file)}
                              disabled={downloading === file.filename}
                              className="flex items-center justify-center p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Download"
                            >
                              {downloading === file.filename ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => openDeleteConfirm(file)}
                              disabled={deleting === file.filename}
                              className="flex items-center justify-center p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Delete"
                            >
                              {deleting === file.filename ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-3 border-t border-slate-700/50 flex items-center justify-between">
                <div className="text-sm text-slate-400">
                  Showing {files.length} of {totalCount} reports
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className="px-3 py-2 rounded-lg bg-slate-700/50 text-slate-400 hover:bg-slate-600/50 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-slate-400">
                    Page {safePage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    className="px-3 py-2 rounded-lg bg-slate-700/50 text-slate-400 hover:bg-slate-600/50 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
            </>
          )}

          {/* Tab: Model Reports CSV */}
          {activeTab === 'csv' && (
            <>
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-200">Export prediction results to CSV</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Generate a CSV from the Predictions API (date range up to 48 hours).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCsvModalOpen(true)}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all bg-emerald-600 text-white shadow shadow-emerald-600/30 hover:bg-emerald-500 shrink-0 w-fit"
                  >
                    <FilePlus className="w-3.5 h-3.5" />
                    <span>Generate report</span>
                  </button>
                </div>
              </div>

              {exportsLoading ? (
                <LoadingSpinner message="Loading CSV exports..." size="lg" />
              ) : exportsError ? (
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-red-500/40 p-6">
                  <p className="text-sm text-red-300">
                    Failed to load CSV exports. Please try again later.
                  </p>
                </div>
              ) : csvFiles.length === 0 ? (
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-12 text-center">
                  <p className="text-slate-400">No CSV reports yet</p>
                </div>
              ) : (
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
                  <div className="flex items-center justify-end px-4 py-2 border-b border-slate-700/50 bg-slate-800/70">
                    <button
                      type="button"
                      onClick={() => refetchExports()}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-600/70 text-xs text-slate-200 hover:bg-slate-700/70 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RefreshCcw className="w-3.5 h-3.5" />
                      <span>Refresh</span>
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-700/50">
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">File</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Size</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Modified</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/30">
                        {csvFiles.map((file) => (
                          <tr key={file.filename} className="hover:bg-slate-700/30 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-slate-400" />
                                <span className="text-sm text-slate-100 font-mono truncate max-w-[360px]" title={file.filename}>
                                  {file.filename}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-300">{formatBytes(file.size_bytes)}</td>
                            <td className="px-4 py-3 text-sm text-slate-300">{formatDate(file.modified_at)}</td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end">
                                <button
                                  onClick={() => handleCsvDownload(file)}
                                  disabled={csvDownloading === file.filename}
                                  className="flex items-center justify-center p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Download CSV"
                                >
                                  {csvDownloading === file.filename ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Download className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <ExportCsvModal
          isOpen={csvModalOpen}
          onClose={() => setCsvModalOpen(false)}
          onSuccess={(message) => {
            setToastMessage(message);
            queryClient.invalidateQueries({ queryKey: ['exports-files'] });
          }}
          onError={(message) => setToastMessage(message)}
        />

        {fileToDelete && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={closeDeleteConfirm}
          >
            <div
              className="rounded-xl bg-slate-800 border border-slate-600 shadow-xl p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-slate-200 mb-6">
                Delete report &quot;{fileToDelete.filename}&quot;?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={closeDeleteConfirm}
                  className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-500 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {toastMessage && (
          <div className="fixed bottom-4 right-4 z-50">
            <div className="px-4 py-3 rounded-lg bg-slate-900 border border-emerald-500/60 shadow-lg shadow-emerald-500/20 text-sm text-slate-100 max-w-sm">
              {toastMessage}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

