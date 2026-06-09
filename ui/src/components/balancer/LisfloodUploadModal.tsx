import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Trash2, FileText, AlertCircle, Loader2 } from 'lucide-react';

interface LisfloodUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (file: File) => void;
  targetTimestamp: string;
  formattedTimestamp: string;
  isUploading: boolean;
  initialFile: File | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function LisfloodUploadModalContent({
  isOpen,
  onClose,
  onConfirm,
  targetTimestamp,
  formattedTimestamp,
  isUploading,
  initialFile,
}: LisfloodUploadModalProps) {
  const [file, setFile] = useState<File | null>(initialFile);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFile(initialFile);
    }
  }, [isOpen, initialFile]);

  if (!isOpen) return null;

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (!selected.name.endsWith('.zip')) {
        alert(`Only .zip files allowed. Invalid: ${selected.name}`);
        e.target.value = '';
        return;
      }
      setFile(selected);
    }
    e.target.value = '';
  };

  const handleConfirm = async () => {
    if (file) {
      await onConfirm(file);
    }
  };

  const isDefault = targetTimestamp === 'unknown';
  const destFilename = isDefault ? 'init_default.zip' : `init_${targetTimestamp}.zip`;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div>
            <h3 className="text-lg font-semibold text-white">Update Lisflood State</h3>
            {!isDefault && (
              <p className="text-sm text-slate-400 mt-1">
                Target: <span className="text-amber-400">{formattedTimestamp}</span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="p-1 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info banner */}
        <div className="mx-4 mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="flex gap-2">
            <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-300">
              File will be uploaded as{' '}
              <code className="bg-slate-700 px-1 rounded">{destFilename}</code>
              {' '}to the balancer recover folder.
            </div>
          </div>
        </div>

        {/* File area */}
        <div className="p-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {file ? (
            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg group">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{file.name}</p>
                  <p className="text-xs text-slate-500">
                    {formatBytes(file.size)} → <span className="text-emerald-400">{destFilename}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFile(null)}
                disabled={isUploading}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 rounded transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-8 text-center text-slate-500 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-blue-500 hover:text-blue-400 transition-colors"
            >
              <Upload className="w-8 h-8 mx-auto mb-2" />
              Click to select a .zip file
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-700">
          <button
            onClick={onClose}
            disabled={isUploading}
            className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!file || isUploading}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload & Replace
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LisfloodUploadModal(props: LisfloodUploadModalProps) {
  if (!props.isOpen) return null;
  return createPortal(
    <LisfloodUploadModalContent {...props} />,
    document.body
  );
}
