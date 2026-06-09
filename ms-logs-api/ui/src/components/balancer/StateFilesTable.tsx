import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getGroupedStateFiles,
  downloadStateFiles,
  uploadStateFiles,
  StateFileGroup,
} from './api';
import UploadModal from './UploadModal';
import {
  FileText,
  RefreshCw,
  FolderOpen,
  HardDrive,
  Download,
  Upload,
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle,
  XCircle,
  Info,
  Globe,
} from 'lucide-react';

type Language = 'en' | 'es';

const translations = {
  en: {
    title: 'State Files',
    basinStates: 'Basin States',
    recover: 'Recover',
    uploadStates: 'Upload States',
    update: 'Update',
    downloadZip: 'Download ZIP',
    loading: 'Loading...',
    noFiles: 'No state files found',
    files: 'files',
    basin: 'Basin',
    size: 'Size',
    titleInfo: 'Basin conditions used by HEC-HMS to initialize simulations.',
    basinStatesInfo: 'Current active states updated after each run.',
    recoverInfo: 'Historical states with timestamps for recovery.',
  },
  es: {
    title: 'Archivos de Estado',
    basinStates: 'Estados de Cuenca',
    recover: 'Recuperar',
    uploadStates: 'Subir Estados',
    update: 'Actualizar',
    downloadZip: 'Descargar ZIP',
    loading: 'Cargando...',
    noFiles: 'No se encontraron archivos de estado',
    files: 'archivos',
    basin: 'Cuenca',
    size: 'Tamaño',
    titleInfo: 'Condiciones de cuenca usadas por HEC-HMS para iniciar simulaciones.',
    basinStatesInfo: 'Estados activos actualizados después de cada ejecución.',
    recoverInfo: 'Estados históricos con marcas de tiempo para recuperación.',
  },
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

interface InfoTooltipProps {
  text: string;
}

function InfoTooltip({ text }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        className="p-1 text-slate-400 hover:text-blue-400 transition-colors"
      >
        <Info className="w-4 h-4" />
      </button>
      {isVisible && (
        <div className="absolute z-50 left-6 top-0 w-72 p-3 bg-slate-800 border border-slate-600 rounded-lg shadow-xl text-sm text-slate-300 leading-relaxed">
          <div className="absolute -left-2 top-2 w-0 h-0 border-t-8 border-b-8 border-r-8 border-transparent border-r-slate-600" />
          {text}
        </div>
      )}
    </div>
  );
}

interface StateGroupCardProps {
  group: StateFileGroup;
  onDownload: (timestamp: string) => void;
  isDownloading: boolean;
  onUpdateClick: (group: StateFileGroup, files: File[]) => void;
  t: typeof translations.en;
}

function StateGroupCard({ group, onDownload, isDownloading, onUpdateClick, t }: StateGroupCardProps) {
  const [expanded, setExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files) as File[];

      // Validate all files are .state
      const invalidFiles = fileArray.filter((f: File) => !f.name.endsWith('.state'));
      if (invalidFiles.length > 0) {
        alert(`Only .state files allowed. Invalid: ${invalidFiles.map((f: File) => f.name).join(', ')}`);
        e.target.value = '';
        return;
      }

      // Open modal with selected files
      onUpdateClick(group, fileArray);
    }
    e.target.value = '';
  };

  // Extract basin name properly for display
  const getBasinName = (filename: string) => {
    if (filename.includes('__')) {
      return filename.split('__')[1]?.replace('.state', '') || filename.replace('.state', '');
    }
    return filename.replace('.state', '');
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
            {group.formatted_timestamp && group.formatted_timestamp !== 'Unknown' && (
              <p className="text-white font-medium">{group.formatted_timestamp}</p>
            )}
            <p className={`text-xs ${group.formatted_timestamp && group.formatted_timestamp !== 'Unknown' ? 'text-slate-400' : 'text-white font-medium'}`}>
              {group.files.length} {t.files} - {formatBytes(group.total_size)}
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
            <span className="text-sm">{t.update}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".state"
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
            <span className="text-sm">{t.downloadZip}</span>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-700/30">
          <table className="w-full">
            <thead className="bg-slate-900/30">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-400">
                  {t.basin}
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-400">
                  {t.size}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/20">
              {group.files.map((file) => (
                <tr key={file.filename} className="hover:bg-slate-700/20">
                  <td className="px-4 py-2">
                    <span className="text-sm text-white font-mono">{getBasinName(file.filename)}</span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="text-sm text-slate-400">{formatBytes(file.size)}</span>
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
  files: File[];
}

export default function StateFilesTable() {
  const [activeTab, setActiveTab] = useState<'recover' | 'root'>('root');
  const [downloadingTimestamp, setDownloadingTimestamp] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false, group: null, files: [] });
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('configLanguage') as Language) || 'en';
    }
    return 'en';
  });
  const queryClient = useQueryClient();

  const t = translations[language];

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('configLanguage', lang);
  };

  const recoverQuery = useQuery({
    queryKey: ['state-files-grouped', 'recover'],
    queryFn: () => getGroupedStateFiles('recover'),
    refetchInterval: 10000,
  });

  const rootQuery = useQuery({
    queryKey: ['state-files-grouped', 'root'],
    queryFn: () => getGroupedStateFiles('root'),
    refetchInterval: 10000,
  });

  const activeQuery = activeTab === 'recover' ? recoverQuery : rootQuery;
  // Filter out 'unknown' timestamps only for recover tab
  // For root tab, show all groups including 'unknown' (which represents current active states)
  const groups = activeTab === 'recover' 
    ? (activeQuery.data?.groups || []).filter((g: StateFileGroup) => g.timestamp !== 'unknown')
    : (activeQuery.data?.groups || []);

  const handleDownload = async (timestamp: string) => {
    setDownloadingTimestamp(timestamp);
    try {
      const blob = await downloadStateFiles(timestamp, activeTab);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // For root files (unknown timestamp), use simple name
      a.download = timestamp === 'unknown' ? 'states.zip' : `states_${timestamp}.zip`;
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

  const handleUpdateClick = (group: StateFileGroup, files: File[]) => {
    setModalState({ isOpen: true, group, files });
  };

  const handleModalClose = () => {
    setModalState({ isOpen: false, group: null, files: [] });
  };

  const handleModalConfirm = async (files: File[]) => {
    if (!modalState.group) return;

    if (files.length !== 6) {
      alert(`Must upload exactly 6 .state files. You selected ${files.length}.`);
      return;
    }

    setUploadStatus('uploading');
    setUploadMessage(`Updating ${modalState.group.formatted_timestamp}...`);
    try {
      const result = await uploadStateFiles(files, activeTab, modalState.group.timestamp);
      setUploadStatus('success');
      setUploadMessage(result.message);
      queryClient.invalidateQueries({ queryKey: ['state-files-grouped'] });
      // Close modal after successful upload
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
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex items-center gap-2">
              <div>
                <h2 className="text-lg font-semibold text-white">{t.title}</h2>
                <p className="text-sm text-slate-400">
                  {activeQuery.data?.path || t.loading}
                </p>
              </div>
              <InfoTooltip text={t.titleInfo} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Language Selector */}
            <div className="flex items-center gap-1 bg-slate-700/50 rounded-lg p-1 mr-2">
              <Globe className="w-4 h-4 text-slate-400 ml-2" />
              <button
                onClick={() => handleLanguageChange('en')}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  language === 'en'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => handleLanguageChange('es')}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  language === 'es'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ES
              </button>
            </div>
            <button
              onClick={() => activeQuery.refetch()}
              disabled={activeQuery.isFetching}
              className="p-2 text-slate-400 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${activeQuery.isFetching ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Upload status message */}
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

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setActiveTab('root')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'root'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            {t.basinStates} ({rootQuery.data?.total_files || 0})
            <InfoTooltip text={t.basinStatesInfo} />
          </button>
          <button
            onClick={() => setActiveTab('recover')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'recover'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            {t.recover} ({recoverQuery.data?.total_files || 0})
            <InfoTooltip text={t.recoverInfo} />
          </button>
        </div>
      </div>

      <div className="max-h-[500px] overflow-y-auto p-4 space-y-3">
        {activeQuery.isLoading ? (
          <div className="p-8 text-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            {t.loading}
          </div>
        ) : activeQuery.error ? (
          <div className="p-8 text-center text-rose-400">
            Error: {(activeQuery.error as Error).message}
          </div>
        ) : groups.length === 0 ? (
          <div className="p-8 text-center text-slate-400">{t.noFiles}</div>
        ) : (
          groups.map((group: StateFileGroup) => (
            <StateGroupCard
              key={group.timestamp}
              group={group}
              onDownload={handleDownload}
              isDownloading={downloadingTimestamp === group.timestamp}
              onUpdateClick={handleUpdateClick}
              t={t}
            />
          ))
        )}
      </div>

      {/* Upload Modal */}
      {modalState.group && (
        <UploadModal
          isOpen={modalState.isOpen}
          onClose={handleModalClose}
          onConfirm={handleModalConfirm}
          targetTimestamp={modalState.group.timestamp}
          formattedTimestamp={modalState.group.formatted_timestamp}
          isUploading={uploadStatus === 'uploading'}
          initialFiles={modalState.files}
          location={activeTab}
        />
      )}
    </div>
  );
}
