import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getLisfloodGroupedStateFiles,
  downloadLisfloodStateFile,
  uploadLisfloodStateFile,
  StateFileGroup,
} from './api';
import LisfloodUploadModal from './LisfloodUploadModal';
import {
  Archive,
  RefreshCw,
  FolderOpen,
  Download,
  Upload,
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle,
  XCircle,
} from 'lucide-react';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

interface LisfloodGroupCardProps {
  group: StateFileGroup;
  onDownload: (timestamp: string) => void;
  isDownloading: boolean;
  onUpdateClick: (group: StateFileGroup, file: File) => void;
}

function LisfloodGroupCard({ group, onDownload, isDownloading, onUpdateClick }: LisfloodGroupCardProps) {
  const [expanded, setExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDefault = group.timestamp === 'unknown';
  const label = isDefault ? 'Default State' : group.formatted_timestamp;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (!selected.name.endsWith('.zip')) {
        alert(`Only .zip files allowed. Invalid: ${selected.name}`);
        e.target.value = '';
        return;
      }
      onUpdateClick(group, selected);
    }
    e.target.value = '';
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700/30 rounded-lg overflow-hidden">
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-700/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
          <div>
            <p className={`font-medium ${isDefault ? 'text-amber-400' : 'text-white'}`}>{label}</p>
            <p className="text-xs text-slate-400">
              {group.files.length} file — {formatBytes(group.total_size)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span className="text-sm">Update</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload(group.timestamp);
            }}
            disabled={isDownloading}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors disabled:opacity-50"
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span className="text-sm">Download ZIP</span>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-700/30">
          <table className="w-full">
            <thead className="bg-slate-900/30">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-400">File</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-400">Size</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-400">Modified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/20">
              {group.files.map((file) => (
                <tr key={file.filename} className="hover:bg-slate-700/20">
                  <td className="px-4 py-2">
                    <span className="text-sm text-white font-mono">{file.filename}</span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="text-sm text-slate-400">{formatBytes(file.size)}</span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="text-sm text-slate-400">
                      {file.mtime ? new Date(file.mtime).toLocaleString() : '-'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface ModalState {
  isOpen: boolean;
  group: StateFileGroup | null;
  file: File | null;
}

export default function LisfloodStateFilesTable() {
  const [downloadingTimestamp, setDownloadingTimestamp] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false, group: null, file: null });
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['lisflood-state-files-grouped'],
    queryFn: getLisfloodGroupedStateFiles,
    refetchInterval: 10000,
  });

  const groups = query.data?.groups || [];

  const handleDownload = async (timestamp: string) => {
    setDownloadingTimestamp(timestamp);
    try {
      const blob = await downloadLisfloodStateFile(timestamp);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = timestamp === 'unknown' ? 'init_default.zip' : `init_${timestamp}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setDownloadingTimestamp(null);
    }
  };

  const handleUpdateClick = (group: StateFileGroup, file: File) => {
    setModalState({ isOpen: true, group, file });
  };

  const handleModalClose = () => {
    setModalState({ isOpen: false, group: null, file: null });
  };

  const handleModalConfirm = async (file: File) => {
    if (!modalState.group) return;

    setUploadStatus('uploading');
    setUploadMessage(`Updating ${modalState.group.formatted_timestamp}...`);
    try {
      const result = await uploadLisfloodStateFile(file, modalState.group.timestamp !== 'unknown' ? modalState.group.timestamp : undefined);
      setUploadStatus('success');
      setUploadMessage(result.message);
      queryClient.invalidateQueries({ queryKey: ['lisflood-state-files-grouped'] });
      handleModalClose();
      setTimeout(() => setUploadStatus('idle'), 3000);
    } catch (error) {
      setUploadStatus('error');
      setUploadMessage((error as Error).message);
      setTimeout(() => setUploadStatus('idle'), 5000);
    }
  };

  return (
    <div className="bg-slate-800/30 backdrop-blur border border-slate-700/30 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-slate-700/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-500/20 rounded-lg">
              <Archive className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Lisflood State Files</h2>
              <p className="text-sm text-slate-400">
                {query.data?.path || 'Loading...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-700/50 rounded-lg">
              <FolderOpen className="w-4 h-4 text-violet-400" />
              <span className="text-sm text-slate-300">Recover ({query.data?.total_files || 0})</span>
            </div>
            <button
              onClick={() => query.refetch()}
              disabled={query.isFetching}
              className="p-2 text-slate-400 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${query.isFetching ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Upload status */}
        {uploadStatus !== 'idle' && (
          <div
            className={`mt-3 p-2 rounded-lg flex items-center gap-2 text-sm ${
              uploadStatus === 'success'
                ? 'bg-emerald-500/20 text-emerald-400'
                : uploadStatus === 'error'
                ? 'bg-rose-500/20 text-rose-400'
                : 'bg-blue-500/20 text-blue-400'
            }`}
          >
            {uploadStatus === 'success' && <CheckCircle className="w-4 h-4" />}
            {uploadStatus === 'error' && <XCircle className="w-4 h-4" />}
            {uploadStatus === 'uploading' && <Loader2 className="w-4 h-4 animate-spin" />}
            {uploadMessage || 'Uploading...'}
          </div>
        )}
      </div>

      <div className="max-h-[500px] overflow-y-auto p-4 space-y-3">
        {query.isLoading ? (
          <div className="p-8 text-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading...
          </div>
        ) : query.error ? (
          <div className="p-8 text-center text-rose-400">
            Error: {(query.error as Error).message}
          </div>
        ) : groups.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No Lisflood state files found</div>
        ) : (
          groups.map((group: StateFileGroup) => (
            <LisfloodGroupCard
              key={group.timestamp}
              group={group}
              onDownload={handleDownload}
              isDownloading={downloadingTimestamp === group.timestamp}
              onUpdateClick={handleUpdateClick}
            />
          ))
        )}
      </div>

      {modalState.group && (
        <LisfloodUploadModal
          isOpen={modalState.isOpen}
          onClose={handleModalClose}
          onConfirm={handleModalConfirm}
          targetTimestamp={modalState.group.timestamp}
          formattedTimestamp={modalState.group.formatted_timestamp}
          isUploading={uploadStatus === 'uploading'}
          initialFile={modalState.file}
        />
      )}
    </div>
  );
}
