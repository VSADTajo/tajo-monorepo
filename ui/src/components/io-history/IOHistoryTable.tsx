import React, { useState, useMemo } from 'react';
import { IOHistoryFile, DownloadFormat } from '../../types/io-history';
import { Download, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Folder, FolderOpen, FileText, FileCode } from 'lucide-react';

interface IOHistoryTableProps {
  files: IOHistoryFile[];
  onDownload: (file: IOHistoryFile, format: DownloadFormat) => void;
  downloadingFile: string | null;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

interface FileGroup {
  key: string;
  job_id: number;
  simulation_date: string;
  provider: string;
  ensemble: string | null;
  simulation_environment: string | null;
  files: IOHistoryFile[];
  total_size: number;
  created_at: string;
}

export default function IOHistoryTable({
  files,
  onDownload,
  downloadingFile,
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
}: IOHistoryTableProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Group files by job_id + simulation_date
  const groupedFiles = useMemo(() => {
    const groups: Map<string, FileGroup> = new Map();

    files.forEach((file) => {
      const key = `${file.job_id}_${file.simulation_date}_${file.provider}`;

      if (groups.has(key)) {
        const group = groups.get(key)!;
        group.files.push(file);
        group.total_size += file.original_size_bytes;
        // Keep the most recent created_at
        if (file.created_at > group.created_at) {
          group.created_at = file.created_at;
        }
      } else {
        groups.set(key, {
          key,
          job_id: file.job_id,
          simulation_date: file.simulation_date,
          provider: file.provider,
          ensemble: file.ensemble ?? null,
          simulation_environment: file.simulation_environment ?? null,
          files: [file],
          total_size: file.original_size_bytes,
          created_at: file.created_at,
        });
      }
    });

    return Array.from(groups.values());
  }, [files]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const formatSimulationDate = (simDate: string) => {
    if (!simDate || simDate.length < 10) return simDate;
    const year = simDate.slice(0, 4);
    const month = simDate.slice(4, 6);
    const day = simDate.slice(6, 8);
    const hour = simDate.slice(8, 10);
    return `${year}-${month}-${day} ${hour}:00`;
  };

  const getFileTypeIcon = (fileType: string) => {
    switch (fileType) {
      case 'csv':
        return <FileText className="w-4 h-4 text-green-400" />;
      case 'xml':
        return <FileCode className="w-4 h-4 text-blue-400" />;
      default:
        return <FileText className="w-4 h-4 text-slate-400" />;
    }
  };

  const formatSimulationEnvironment = (env: string | null) => {
    if (!env) return null;
    switch (env) {
      case 'HEC_HMS_AUTO':    return { label: 'HEC-HMS Auto',    color: 'bg-cyan-500/20 text-cyan-400' };
      case 'HEC_HMS_MANUAL':  return { label: 'HEC-HMS Manual',  color: 'bg-indigo-500/20 text-indigo-400' };
      case 'HEC_HMS_MOCK':    return { label: 'HEC-HMS Mock',    color: 'bg-slate-500/20 text-slate-400' };
      case 'LISFLOOD_AUTO':   return { label: 'Lisflood Auto',   color: 'bg-violet-500/20 text-violet-400' };
      case 'LISFLOOD_MANUAL': return { label: 'Lisflood Manual', color: 'bg-pink-500/20 text-pink-400' };
      default: return { label: env, color: 'bg-slate-500/20 text-slate-400' };
    }
  };

  const getOriginalFilename = (file: IOHistoryFile) => {
    // Try to get original_filename from file, fallback to file name
    return (file as any).original_filename || file.file;
  };

  if (files.length === 0) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-12 text-center">
        <p className="text-slate-400">No files found</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider w-8"></th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Job / Files</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Provider</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Model</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Simulation Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Ensemble</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Size</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Created</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Download</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {groupedFiles.map((group) => {
              const isExpanded = expandedGroups.has(group.key);
              const hasMultipleFiles = group.files.length > 1;

              return (
                <React.Fragment key={group.key}>
                  {/* Group Row */}
                  <tr
                    className={`hover:bg-slate-700/30 transition-colors ${hasMultipleFiles ? 'cursor-pointer' : ''}`}
                    onClick={() => hasMultipleFiles && toggleGroup(group.key)}
                  >
                    <td className="px-4 py-3">
                      {hasMultipleFiles ? (
                        <button className="text-slate-400 hover:text-white">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {hasMultipleFiles ? (
                          isExpanded ? (
                            <FolderOpen className="w-5 h-5 text-amber-400" />
                          ) : (
                            <Folder className="w-5 h-5 text-amber-400" />
                          )
                        ) : (
                          getFileTypeIcon(group.files[0].file_type)
                        )}
                        <div>
                          <span className="text-sm text-white font-medium">
                            Job {group.job_id}
                          </span>
                          <span className="text-xs text-slate-400 ml-2">
                            ({group.files.length} {group.files.length === 1 ? 'file' : 'files'})
                          </span>
                          {!hasMultipleFiles && (
                            <div className="text-xs text-slate-500 font-mono truncate max-w-[200px]">
                              {getOriginalFilename(group.files[0])}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        group.provider === 'WRF' ? 'bg-emerald-500/20 text-emerald-400' :
                        group.provider === 'ECMWF' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-amber-500/20 text-amber-400'
                      }`}>
                        {group.provider}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const env = formatSimulationEnvironment(group.simulation_environment);
                        return env ? (
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${env.color}`}>
                            {env.label}
                          </span>
                        ) : <span className="text-slate-500 text-xs">-</span>;
                      })()}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">{formatSimulationDate(group.simulation_date)}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{group.ensemble || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{formatBytes(group.total_size)}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{formatDate(group.created_at)}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end">
                        <button
                          onClick={() => onDownload(group.files[0], DownloadFormat.ORIGINAL)}
                          disabled={downloadingFile === group.files[0].file}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors disabled:opacity-50"
                          title={`Download ZIP with ${group.files.length} file(s)`}
                        >
                          {downloadingFile === group.files[0].file ? (
                            <span className="animate-spin text-sm">...</span>
                          ) : (
                            <>
                              <Download className="w-4 h-4" />
                              <span className="text-xs font-medium">ZIP</span>
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Files */}
                  {isExpanded && group.files.map((file) => (
                    <tr key={file.file} className="bg-slate-800/30">
                      <td className="px-4 py-2"></td>
                      <td className="px-4 py-2 pl-12">
                        <div className="flex items-center gap-2">
                          {getFileTypeIcon(file.file_type)}
                          <span className="text-sm text-slate-300 font-mono truncate max-w-[250px]" title={getOriginalFilename(file)}>
                            {getOriginalFilename(file)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-400">{file.file_type.toUpperCase()}</td>
                      <td className="px-4 py-2"></td>
                      <td className="px-4 py-2"></td>
                      <td className="px-4 py-2"></td>
                      <td className="px-4 py-2 text-sm text-slate-400">{formatBytes(file.original_size_bytes)}</td>
                      <td className="px-4 py-2 text-sm text-slate-500">{formatDate(file.created_at)}</td>
                      <td className="px-4 py-2"></td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-4 py-3 border-t border-slate-700/50 flex items-center justify-between">
        <div className="text-sm text-slate-400">
          Showing {groupedFiles.length} jobs ({totalItems} files total)
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-2 rounded-lg bg-slate-700/50 text-slate-400 hover:bg-slate-600/50 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-slate-400">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="p-2 rounded-lg bg-slate-700/50 text-slate-400 hover:bg-slate-600/50 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
